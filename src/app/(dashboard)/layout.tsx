import { Sidebar } from '@/components/layout/Sidebar'
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
    supabase.from('users').select('*').eq('id', user.id).single(),
    supabase.from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false),
  ])

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar user={profile} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header user={profile} unreadCount={unreadCount ?? 0} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
      <GlobalSearch />
    </div>
  )
}
