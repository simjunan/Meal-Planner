import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Groq from 'groq-sdk';

// Vercel Hobby: 10s max execution.
export const maxDuration = 10;

const DISH_TYPES = ['soup', 'meat', 'vegetable'] as const;
type DishType = typeof DISH_TYPES[number];
type MealSlot = 'breakfast' | 'lunch' | 'dinner';

const ALL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner'];

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

  // Suggest for tomorrow only — single day keeps the AI prompt simple and reliable
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const [
    { data: recentMeals },
    { data: bookmarks },
    { data: candidatePool },
    { data: tomorrowPlans },
  ] = await Promise.all([
    supabase
      .from('meal_plans')
      .select('recipe_id, plan_date, recipes(name)')
      .eq('user_id', user.id)
      .gte('plan_date', fourteenDaysAgo.toISOString().split('T')[0])
      .order('plan_date', { ascending: false }),
    supabase
      .from('bookmarks')
      .select('recipe_id, recipes(cuisine)')
      .eq('user_id', user.id)
      .limit(30),
    // Candidate pool: top 200 by rating, AI will pick from a focused subset
    supabase
      .from('recipes')
      .select('id, name, cuisine, dish_type, avg_rating')
      .order('avg_rating', { ascending: false })
      .limit(200),
    // What is already planned for tomorrow?
    supabase
      .from('meal_plans')
      .select('meal_slot, recipes(dish_type)')
      .eq('user_id', user.id)
      .eq('plan_date', tomorrowStr),
  ]);

  // Determine free slots and which dish types are still needed
  const plannedSlots = new Set((tomorrowPlans ?? []).map((p) => p.meal_slot as MealSlot));
  const plannedDishTypes = new Set(
    (tomorrowPlans ?? [])
      .map((p) => {
        const r = p.recipes;
        return Array.isArray(r) ? r[0]?.dish_type : (r as { dish_type?: string } | null)?.dish_type;
      })
      .filter((t): t is string => !!t && t !== 'other')
  );

  const freeSlots = ALL_SLOTS.filter((s) => !plannedSlots.has(s));
  const neededTypes = DISH_TYPES.filter((t) => !plannedDishTypes.has(t));

  if (freeSlots.length === 0) {
    return NextResponse.json({ recommendations: [] });
  }

  // Assign a target dish type to each free slot
  const slotsToFill: { slot: MealSlot; dishType: DishType | null }[] = freeSlots.map((slot, i) => ({
    slot,
    dishType: neededTypes[i] ?? null,
  }));

  // Build exclude set (last 7 days)
  const last7DayIds = new Set(
    (recentMeals ?? [])
      .filter((m) => m.plan_date >= sevenDaysAgo.toISOString().split('T')[0])
      .map((m) => m.recipe_id)
  );

  // Preferred cuisines from bookmarks
  const cuisineCounts: Record<string, number> = {};
  (bookmarks ?? []).forEach((b) => {
    const r = b.recipes;
    const cuisine = Array.isArray(r) ? r[0]?.cuisine : (r as { cuisine?: string } | null)?.cuisine;
    if (cuisine) cuisineCounts[cuisine] = (cuisineCounts[cuisine] ?? 0) + 1;
  });
  const topCuisines = Object.entries(cuisineCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([c]) => c);

  // Pool available to recommend (sorted by rating DESC, already excludes last 7 days)
  const available = (candidatePool ?? []).filter((r) => !last7DayIds.has(r.id));

  // --- SERVER-SIDE FALLBACK ---
  // Used when AI misses a slot or returns an invalid recipe ID
  const serverPickedIds = new Set<string>();
  function serverPickForSlot(dishType: DishType | null): string | null {
    const preferred = new Set(topCuisines);
    let match = available.find(
      (r) =>
        !serverPickedIds.has(r.id) &&
        (dishType === null || r.dish_type === dishType) &&
        preferred.has(r.cuisine ?? '')
    );
    if (!match) {
      match = available.find(
        (r) => !serverPickedIds.has(r.id) && (dishType === null || r.dish_type === dishType)
      );
    }
    if (!match) {
      match = available.find((r) => !serverPickedIds.has(r.id));
    }
    if (!match) return null;
    serverPickedIds.add(match.id);
    return match.id;
  }

  // --- GROQ AI SELECTION ---
  // Build a focused prompt: one slot per entry with a small candidate list.
  // The AI picks recipe IDs; a server-side fallback covers any missed slots.

  // Recent recipe names (for "avoid repeating" hint)
  const recentNames = (recentMeals ?? [])
    .filter((m) => m.plan_date >= sevenDaysAgo.toISOString().split('T')[0])
    .map((m) => {
      const r = m.recipes;
      return Array.isArray(r) ? r[0]?.name : (r as { name?: string } | null)?.name;
    })
    .filter(Boolean)
    .slice(0, 5) as string[];

  // Up to 12 candidates per slot, filtered by dish type
  function slotCandidates(dishType: DishType | null) {
    return available
      .filter((r) => dishType === null || r.dish_type === dishType)
      .slice(0, 12);
  }

  const slotBlocks = slotsToFill
    .map(({ slot, dishType }) => {
      const candidates = slotCandidates(dishType);
      const rows = candidates
        .map((r) => `  ${r.id} | ${r.name} | ${r.cuisine ?? 'N/A'}`)
        .join('\n');
      return `${slot} (dish type: ${dishType ?? 'any'})\n${rows || '  (no typed candidates — pick any from other slots)'}`;
    })
    .join('\n\n');

  const expectedJson = JSON.stringify({
    picks: slotsToFill.map(({ slot }) => ({ slot, recipe_id: '<uuid-from-candidates>' })),
  });

  const prompt = `You are a meal planner. Tomorrow's free meal slots need recipes.

User preferences:
- Favourite cuisines: ${topCuisines.join(', ') || 'no preference'}
- Avoid recently eaten: ${recentNames.join(', ') || 'nothing to avoid'}

For each slot below, pick exactly ONE recipe_id from the candidate list.

${slotBlocks}

Respond ONLY with valid JSON — no markdown, no explanation:
${expectedJson}`;

  let aiPicks: Record<string, string> = {};

  if (process.env.GROQ_API_KEY) {
    try {
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 300,
        response_format: { type: 'json_object' },
      });
      const raw = completion.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.picks)) {
        for (const pick of parsed.picks) {
          if (typeof pick.slot === 'string' && typeof pick.recipe_id === 'string') {
            aiPicks[pick.slot] = pick.recipe_id;
          }
        }
      }
    } catch {
      // AI failed — server-side fallback will cover all slots below
    }
  }

  // Validate AI picks: recipe_id must exist in the available pool
  const validIds = new Set(available.map((r) => r.id));
  const aiPickedIds = new Set<string>();
  const validatedPicks: Record<string, string> = {};
  for (const [slot, recipeId] of Object.entries(aiPicks)) {
    if (
      validIds.has(recipeId) &&
      !aiPickedIds.has(recipeId) &&
      recipeId !== '<uuid-from-candidates>'
    ) {
      validatedPicks[slot] = recipeId;
      aiPickedIds.add(recipeId);
      serverPickedIds.add(recipeId); // prevent fallback from picking the same
    }
  }

  // Final recommendations: AI pick where valid, server-side fallback for any gap
  const recommendations = slotsToFill
    .map(({ slot, dishType }) => {
      const recipeId = validatedPicks[slot] ?? serverPickForSlot(dishType);
      if (!recipeId) return null;
      return { recipe_id: recipeId, day_offset: 1, meal_slot: slot };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  // Cache for today
  await supabase.from('ai_recommendation_cache').upsert({
    user_id: user.id,
    cache_date: today,
    recommendations,
  });

  return NextResponse.json({ recommendations });
}
