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
    <div className="flex h-screen overflow-hidden print:block print:h-auto print:overflow-visible" style={{ background: 'var(--hp-surface)' }}>
      {/* Desktop sidebar — не печатается (отчёт собственнику, счёт печатаются браузером) */}
      <div className="contents print:hidden">
        <Sidebar user={profile} />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden w-0 print:block print:w-auto print:overflow-visible">
        <div className="contents print:hidden">
          <Header user={profile} unreadCount={unreadCount ?? 0} />
        </div>
        <main className="flex-1 overflow-y-auto overflow-x-hidden print:overflow-visible">
          {/* Без mx-auto: контент прижат к сайдбару слева и растёт вправо, а не
              центрируется в остатке ширины — на широких мониторах mx-auto
              оставлял между сайдбаром и контентом заметный пустой отступ. */}
          <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] pb-24 md:pb-8 w-full min-w-0 print:p-0 print:max-w-none">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav + drawer */}
      <div className="contents print:hidden">
        <MobileBottomNav user={profile} />
      </div>

      <GlobalSearch />
    </div>
  )
}
