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

  // Onboarding check — redirect new orgs to setup wizard
  const { data: orgMembership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .single()

  if (orgMembership?.organization_id) {
    const { data: org } = await supabase
      .from('organizations')
      .select('onboarding_completed')
      .eq('id', orgMembership.organization_id)
      .single()

    if (org && !org.onboarding_completed) {
      redirect('/onboarding')
    }
  }

  const [{ data: profile }, { count: unreadCount }] = await Promise.all([
    supabase.from('users').select('id, full_name, email, role, avatar_url, is_active, created_at').eq('id', user.id).single(),
    supabase.from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false),
  ])

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--hp-surface)' }}>
      {/* Desktop sidebar */}
      <Sidebar user={profile} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden w-0">
        <Header user={profile} unreadCount={unreadCount ?? 0} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          {/* Без mx-auto: контент прижат к сайдбару слева и растёт вправо, а не
              центрируется в остатке ширины — на широких мониторах mx-auto
              оставлял между сайдбаром и контентом заметный пустой отступ. */}
          <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] pb-24 md:pb-8 w-full min-w-0">
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
