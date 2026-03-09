import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import BottomNav from '@/components/layout/BottomNav';
import AppHeader from '@/components/layout/AppHeader';
import Sidebar from '@/components/layout/Sidebar';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .single();

  const username = profile?.username ?? '';

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar username={username} />
      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader username={username} />
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
        <BottomNav />
      </div>
    </div>
  );
}
