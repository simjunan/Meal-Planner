import { createClient } from '@/lib/supabase/server';
import DashboardClient from './DashboardClient';
import { formatDate, addDays } from '@/lib/utils';

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const tomorrow = formatDate(addDays(new Date(), 1));
  const dayAfter = formatDate(addDays(new Date(), 2));

  // Fetch today's and tomorrow's meal plans
  const { data: upcomingMeals } = await supabase
    .from('meal_plans')
    .select('*, recipe:recipes(*)')
    .eq('user_id', user!.id)
    .gte('plan_date', formatDate(new Date()))
    .lte('plan_date', dayAfter)
    .order('plan_date');

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user!.id)
    .single();

  const { data: bookmarkIds } = await supabase
    .from('bookmarks')
    .select('recipe_id')
    .eq('user_id', user!.id);

  return (
    <DashboardClient
      username={profile?.username ?? ''}
      upcomingMeals={upcomingMeals ?? []}
      bookmarkedIds={(bookmarkIds ?? []).map((b) => b.recipe_id)}
      tomorrow={tomorrow}
      dayAfter={dayAfter}
    />
  );
}
