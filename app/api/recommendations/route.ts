import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Groq from 'groq-sdk';

// Vercel Hobby: 10s max execution. Groq is fast enough in practice.
export const maxDuration = 10;

const DISH_TYPES = ['soup', 'meat', 'vegetable'] as const;
type DishType = typeof DISH_TYPES[number];

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

  let forceRefresh = false;
  try {
    const body = await request.json();
    forceRefresh = !!body.forceRefresh;
  } catch { /* no body or invalid JSON */ }

  const today = new Date().toISOString().split('T')[0];

  // Check cache first (skip if forceRefresh)
  if (!forceRefresh) {
    const { data: cached } = await supabase
      .from('ai_recommendation_cache')
      .select('recommendations')
      .eq('user_id', user.id)
      .eq('cache_date', today)
      .maybeSingle();

    if (cached) {
      return NextResponse.json({ recommendations: cached.recommendations });
    }
  }

  // Compute target dates
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const dayAfterDate = new Date();
  dayAfterDate.setDate(dayAfterDate.getDate() + 2);
  const tomorrowStr = tomorrowDate.toISOString().split('T')[0];
  const dayAfterStr = dayAfterDate.toISOString().split('T')[0];

  // Gather context for the prompt
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const [{ data: recentMeals }, { data: bookmarks }, { data: candidates }, { data: upcomingPlans }] = await Promise.all([
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
      .select('id, name, cuisine, dish_type, avg_rating, rating_count, cook_time_mins')
      .order('rating_count', { ascending: false })
      .limit(80),
    // Fetch existing plans for tomorrow and day-after with dish_type
    supabase
      .from('meal_plans')
      .select('plan_date, meal_slot, recipes(dish_type)')
      .eq('user_id', user.id)
      .in('plan_date', [tomorrowStr, dayAfterStr]),
  ]);

  // Analyse what's already planned for each upcoming day
  function getDayInfo(dateStr: string) {
    const dayPlans = (upcomingPlans ?? []).filter((p) => p.plan_date === dateStr);
    const plannedSlots = new Set(dayPlans.map((p) => p.meal_slot as string));
    const plannedDishTypes = new Set(
      dayPlans
        .map((p) => {
          const r = p.recipes;
          return Array.isArray(r) ? r[0]?.dish_type : (r as { dish_type?: string } | null)?.dish_type;
        })
        .filter((t): t is string => !!t && t !== 'other')
    );
    const freeSlots = (['breakfast', 'lunch', 'dinner'] as const).filter((s) => !plannedSlots.has(s));
    const neededTypes: DishType[] = DISH_TYPES.filter((t) => !plannedDishTypes.has(t));
    return { freeSlots, neededTypes, isComplete: freeSlots.length === 0 };
  }

  const day1Info = getDayInfo(tomorrowStr);
  const day2Info = getDayInfo(dayAfterStr);

  // If both days are fully planned, return empty recommendations
  if (day1Info.isComplete && day2Info.isComplete) {
    return NextResponse.json({ recommendations: [] });
  }

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

  // Build per-day slot instructions
  function buildDayInstructions(info: ReturnType<typeof getDayInfo>, dayLabel: string, dayOffset: number): string {
    if (info.isComplete) return `Day ${dayOffset} (${dayLabel}): All slots filled — skip entirely.`;
    if (info.freeSlots.length === 0) return `Day ${dayOffset} (${dayLabel}): All slots filled — skip entirely.`;

    const slotLines = info.freeSlots.map((slot, i) => {
      const neededType = info.neededTypes[i] ?? 'any';
      return `  - ${slot}: suggest a "${neededType}" dish`;
    });
    return `Day ${dayOffset} (${dayLabel}):\n${slotLines.join('\n')}`;
  }

  const day1Instructions = buildDayInstructions(day1Info, `tomorrow ${tomorrowStr}`, 1);
  const day2Instructions = buildDayInstructions(day2Info, `day after ${dayAfterStr}`, 2);

  // Build expected output schema based on what's actually needed
  const expectedSlots: { day_offset: 1 | 2; meal_slot: string }[] = [
    ...day1Info.freeSlots.map((slot) => ({ day_offset: 1 as const, meal_slot: slot })),
    ...day2Info.freeSlots.map((slot) => ({ day_offset: 2 as const, meal_slot: slot })),
  ];

  const expectedJson = JSON.stringify(
    { recommendations: expectedSlots.map((s) => ({ recipe_id: '<uuid>', ...s })) },
    null,
    2
  );

  const prompt = `You are a meal planner AI. Suggest recipes only for the empty meal slots listed below.

Goal: Each day's meals should collectively include 1 soup dish, 1 meat dish, and 1 vegetable dish across breakfast/lunch/dinner.

Context:
- Top 3 preferred cuisines: ${topCuisines.join(', ') || 'no preference'}
- Exclude these recipe IDs (last 7 days): ${last7DayIds.join(', ') || 'none'}
- At least 1 suggestion must be a discovery (not in: ${[...seenRecipeIds].slice(0, 20).join(', ') || 'none'})

Instructions per day:
${day1Instructions}
${day2Instructions}

Available recipes (id | name | cuisine | dish_type | avg_rating):
${(candidates ?? [])
  .filter((r) => !last7DayIds.includes(r.id))
  .slice(0, 80)
  .map((r) => `${r.id} | ${r.name} | ${r.cuisine ?? 'N/A'} | ${r.dish_type ?? 'other'} | ${r.avg_rating ?? 'N/A'}`)
  .join('\n')}

Return ONLY valid JSON in this exact format (no markdown, no explanation):
${expectedJson}`;

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'GROQ_API_KEY is not configured' }, { status: 503 });
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  let raw: string;
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 512,
      response_format: { type: 'json_object' },
    });
    raw = completion.choices[0]?.message?.content ?? '{}';
  } catch (groqErr) {
    const msg = groqErr instanceof Error ? groqErr.message : 'Groq request failed';
    return NextResponse.json({ error: msg }, { status: 502 });
  }

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
