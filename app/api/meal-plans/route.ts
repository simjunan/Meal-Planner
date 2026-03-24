import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function createSupabase() {
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
          } catch { /* ignore */ }
        },
      },
    }
  );
}

// GET /api/meal-plans?start=YYYY-MM-DD&end=YYYY-MM-DD
export async function GET(request: NextRequest) {
  const supabase = createSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  let query = supabase
    .from('meal_plans')
    .select('*, recipe:recipes(*)')
    .eq('user_id', user.id)
    .order('plan_date');

  if (start) query = query.gte('plan_date', start);
  if (end) query = query.lte('plan_date', end);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ meal_plans: data });
}

// POST /api/meal-plans
export async function POST(request: NextRequest) {
  const supabase = createSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { recipe_id, plan_date, meal_slot } = await request.json();

  // Enforce maximum of 4 dishes per meal slot
  const { count, error: countError } = await supabase
    .from('meal_plans')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('plan_date', plan_date)
    .eq('meal_slot', meal_slot);

  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
  if ((count ?? 0) >= 5) {
    return NextResponse.json(
      { error: 'Maximum of 5 dishes per meal reached. Remove a dish to add a new one.' },
      { status: 422 }
    );
  }

  const { data, error } = await supabase
    .from('meal_plans')
    .insert({ user_id: user.id, recipe_id, plan_date, meal_slot })
    .select('*, recipe:recipes(*)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ meal_plan: data });
}

// DELETE /api/meal-plans
export async function DELETE(request: NextRequest) {
  const supabase = createSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await request.json();

  const { error } = await supabase
    .from('meal_plans')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
