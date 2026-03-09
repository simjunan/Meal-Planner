import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Groq from 'groq-sdk';

// Vercel Hobby: 10s max execution. Groq is fast enough in practice.
export const maxDuration = 10;

function createSupabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch { /* read-only in route handlers when called from server component */ }
        },
      },
    }
  );
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date().toISOString().split('T')[0];

  // Check cache first
  const { data: cached } = await supabase
    .from('ai_recommendation_cache')
    .select('recommendations')
    .eq('user_id', user.id)
    .eq('cache_date', today)
    .maybeSingle();

  if (cached) {
    return NextResponse.json({ recommendations: cached.recommendations });
  }

  // Gather context for the prompt
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const [{ data: recentMeals }, { data: bookmarks }, { data: candidates }] = await Promise.all([
    supabase
      .from('meal_plans')
      .select('recipe_id, plan_date, recipes(id, name, cuisine)')
      .eq('user_id', user.id)
      .gte('plan_date', fourteenDaysAgo.toISOString().split('T')[0])
      .order('plan_date', { ascending: false }),
    supabase
      .from('bookmarks')
      .select('recipe_id, recipes(id, name, cuisine)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('recipes')
      .select('id, name, cuisine, avg_rating, rating_count, cook_time_mins')
      .order('rating_count', { ascending: false })
      .limit(200),
  ]);

  const last7DayIds = (recentMeals ?? [])
    .filter((m) => m.plan_date >= sevenDaysAgo.toISOString().split('T')[0])
    .map((m) => m.recipe_id);

  const bookmarkedCuisines = (bookmarks ?? [])
    .map((b) => {
      const r = b.recipes;
      return Array.isArray(r) ? r[0]?.cuisine : (r as { cuisine?: string } | null)?.cuisine;
    })
    .filter(Boolean);

  const cuisineCounts: Record<string, number> = {};
  bookmarkedCuisines.forEach((c: string | undefined) => { if (c) cuisineCounts[c] = (cuisineCounts[c] ?? 0) + 1; });
  const topCuisines = Object.entries(cuisineCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([c]) => c);

  const seenRecipeIds = new Set((recentMeals ?? []).map((m) => m.recipe_id));

  const prompt = `You are a meal planner AI. Suggest 6 recipes for the next 2 days (breakfast, lunch, dinner each day).

Context:
- Top 3 preferred cuisines: ${topCuisines.join(', ') || 'no preference'}
- Exclude these recipe IDs (last 7 days): ${last7DayIds.join(', ') || 'none'}
- At least 1 suggestion per day must be a "discovery" (not in seen IDs: ${[...seenRecipeIds].join(', ') || 'none'})

Available recipes (id | name | cuisine | avg_rating):
${(candidates ?? [])
  .filter((r) => !last7DayIds.includes(r.id))
  .slice(0, 200)
  .map((r) => `${r.id} | ${r.name} | ${r.cuisine ?? 'N/A'} | ${r.avg_rating ?? 'N/A'}`)
  .join('\n')}

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "recommendations": [
    {"recipe_id": "<uuid>", "day_offset": 1, "meal_slot": "breakfast"},
    {"recipe_id": "<uuid>", "day_offset": 1, "meal_slot": "lunch"},
    {"recipe_id": "<uuid>", "day_offset": 1, "meal_slot": "dinner"},
    {"recipe_id": "<uuid>", "day_offset": 2, "meal_slot": "breakfast"},
    {"recipe_id": "<uuid>", "day_offset": 2, "meal_slot": "lunch"},
    {"recipe_id": "<uuid>", "day_offset": 2, "meal_slot": "dinner"}
  ]
}`;

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const completion = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 512,
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0]?.message?.content ?? '{}';
  let parsed: { recommendations?: unknown[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'AI parse error' }, { status: 500 });
  }

  if (!parsed.recommendations) {
    return NextResponse.json({ error: 'No recommendations returned' }, { status: 500 });
  }

  // Cache for today
  await supabase.from('ai_recommendation_cache').upsert({
    user_id: user.id,
    cache_date: today,
    recommendations: parsed.recommendations,
  });

  return NextResponse.json({ recommendations: parsed.recommendations });
}
