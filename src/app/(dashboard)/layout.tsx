import { Sidebar, MobileBottomNav } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { GlobalSearch } from '@/components/search/GlobalSearch'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: profile }, { count: unreadCount }] = await Promise.all([
    supabase.from('users').select('id, full_name, email, role, avatar_url, is_active, created_at').eq('id', user.id).single(),
    supabase.from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false),
  ])

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F8FAFC' }}>
      {/* Desktop sidebar */}
      <Sidebar user={profile} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header user={profile} unreadCount={unreadCount ?? 0} />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto pb-24 md:pb-8">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav + drawer */}
      <MobileBottomNav user={profile} />

      <GlobalSearch />
    </div>
  )
}
