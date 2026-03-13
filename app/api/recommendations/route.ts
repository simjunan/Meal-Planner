import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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

  // Compute target dates
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const dayAfterDate = new Date();
  dayAfterDate.setDate(dayAfterDate.getDate() + 2);
  const tomorrowStr = tomorrowDate.toISOString().split('T')[0];
  const dayAfterStr = dayAfterDate.toISOString().split('T')[0];

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  // Fetch all needed data in parallel
  const [
    { data: recentMeals },
    { data: bookmarks },
    { data: candidatePool },
    { data: upcomingPlans },
  ] = await Promise.all([
    supabase
      .from('meal_plans')
      .select('recipe_id, plan_date')
      .eq('user_id', user.id)
      .gte('plan_date', fourteenDaysAgo.toISOString().split('T')[0])
      .order('plan_date', { ascending: false }),
    supabase
      .from('bookmarks')
      .select('recipe_id, recipes(cuisine)')
      .eq('user_id', user.id)
      .limit(30),
    // Fetch candidate pool sorted by rating — no LLM needed
    supabase
      .from('recipes')
      .select('id, cuisine, dish_type, avg_rating')
      .order('avg_rating', { ascending: false })
      .limit(200),
    // Existing plans for tomorrow and day-after with dish_type info
    supabase
      .from('meal_plans')
      .select('plan_date, meal_slot, recipes(dish_type)')
      .eq('user_id', user.id)
      .in('plan_date', [tomorrowStr, dayAfterStr]),
  ]);

  // Determine free slots and already-covered dish types for a given day
  function getDayInfo(dateStr: string) {
    const dayPlans = (upcomingPlans ?? []).filter((p) => p.plan_date === dateStr);
    const plannedSlots = new Set(dayPlans.map((p) => p.meal_slot as MealSlot));
    const plannedDishTypes = new Set(
      dayPlans
        .map((p) => {
          const r = p.recipes;
          return Array.isArray(r) ? r[0]?.dish_type : (r as { dish_type?: string } | null)?.dish_type;
        })
        .filter((t): t is string => !!t && t !== 'other')
    );
    const freeSlots = ALL_SLOTS.filter((s) => !plannedSlots.has(s));
    const neededTypes = DISH_TYPES.filter((t) => !plannedDishTypes.has(t));
    return { freeSlots, neededTypes, isComplete: freeSlots.length === 0 };
  }

  const day1Info = getDayInfo(tomorrowStr);
  const day2Info = getDayInfo(dayAfterStr);

  if (day1Info.isComplete && day2Info.isComplete) {
    return NextResponse.json({ recommendations: [] });
  }

  // Build the exclude set (recipes eaten in the last 7 days)
  const last7DayIds = new Set(
    (recentMeals ?? [])
      .filter((m) => m.plan_date >= sevenDaysAgo.toISOString().split('T')[0])
      .map((m) => m.recipe_id)
  );

  // Derive preferred cuisines from bookmarks
  const cuisineCounts: Record<string, number> = {};
  (bookmarks ?? []).forEach((b) => {
    const r = b.recipes;
    const cuisine = Array.isArray(r) ? r[0]?.cuisine : (r as { cuisine?: string } | null)?.cuisine;
    if (cuisine) cuisineCounts[cuisine] = (cuisineCounts[cuisine] ?? 0) + 1;
  });
  const preferredCuisines = new Set(
    Object.entries(cuisineCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([c]) => c)
  );

  // Filter out recently eaten recipes; pool is already sorted by avg_rating DESC
  const available = (candidatePool ?? []).filter((r) => !last7DayIds.has(r.id));

  // Track picked IDs within this request to avoid suggesting the same recipe twice
  const pickedIds = new Set<string>();

  function pickForSlot(dishType: DishType | null): string | null {
    // Pass 1: preferred cuisine + correct dish type
    let match = available.find(
      (r) =>
        !pickedIds.has(r.id) &&
        (dishType === null || r.dish_type === dishType) &&
        preferredCuisines.has(r.cuisine ?? '')
    );
    // Pass 2: any cuisine + correct dish type
    if (!match) {
      match = available.find(
        (r) => !pickedIds.has(r.id) && (dishType === null || r.dish_type === dishType)
      );
    }
    // Pass 3: ignore dish_type (fallback when dish_type column is not populated in DB)
    if (!match) {
      match = available.find((r) => !pickedIds.has(r.id));
    }
    if (!match) return null;
    pickedIds.add(match.id);
    return match.id;
  }

  // Build the full list of slots that need filling, with their assigned dish types
  const slotsToFill: { dayOffset: 1 | 2; slot: MealSlot; dishType: DishType | null }[] = [
    ...day1Info.freeSlots.map((slot, i) => ({
      dayOffset: 1 as const,
      slot,
      dishType: day1Info.neededTypes[i] ?? null,
    })),
    ...day2Info.freeSlots.map((slot, i) => ({
      dayOffset: 2 as const,
      slot,
      dishType: day2Info.neededTypes[i] ?? null,
    })),
  ];

  const recommendations = slotsToFill
    .map(({ dayOffset, slot, dishType }) => {
      const recipeId = pickForSlot(dishType);
      if (!recipeId) return null;
      return { recipe_id: recipeId, day_offset: dayOffset, meal_slot: slot };
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
