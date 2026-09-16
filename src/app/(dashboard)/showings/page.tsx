import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Eye, CalendarDays } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/layout/EmptyState'
import { ShowingsView, type ShowingRow } from '@/features/showings/components/ShowingsView'

export default async function ShowingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Имя агента берётся вторым запросом, а не встроенным join: showings.agent_id
  // ссылается на auth.users, и PostgREST такую связь не находит — с хинтом
  // users!showings_agent_id_fkey весь запрос падал с PGRST200, а страница молча
  // показывала «Показов пока нет» при непустой таблице.
  const { data } = await supabase
    .from('showings')
    .select(`
      id, scheduled_at, status, result, duration_min, agent_id,
      property:properties(id, title, address),
      lead:leads(id, full_name)
    `)
    .order('scheduled_at', { ascending: false })
    .limit(500)

  const agentIds = [...new Set((data ?? []).map(s => s.agent_id).filter((v): v is string => !!v))]
  const { data: agents } = agentIds.length > 0
    ? await supabase.from('users').select('id, full_name').in('id', agentIds)
    : { data: [] }
  const agentMap = Object.fromEntries((agents ?? []).map(a => [a.id, a.full_name]))

  const showings: ShowingRow[] = (data ?? []).map(s => {
    const property = s.property as { id: string; title: string | null; address: string | null } | null
    const lead = s.lead as { full_name: string | null } | null
    return {
      id: s.id,
      scheduledAt: s.scheduled_at,
      status: s.status,
      durationMin: s.duration_min,
      propertyId: property?.id ?? null,
      propertyLabel: property?.title ?? property?.address ?? null,
      leadName: lead?.full_name ?? null,
      agentName: (s.agent_id ? agentMap[s.agent_id] : null) ?? null,
    }
  })

  return (
    <div className="space-y-5">
      <PageHeader
        title="Показы"
        subtitle={`${showings.length} показов`}
        actions={
          <>
            <Link href="/calendar?kind=showing" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
              <CalendarDays style={{ width: 16, height: 16 }} />
              Календарь
            </Link>
            <Link href="/showings/new" className={buttonVariants({ size: 'sm' })}>
              <Plus style={{ width: 16, height: 16 }} />
              Новый показ
            </Link>
          </>
        }
      />

      {showings.length === 0 ? (
        <EmptyState
          icon={<Eye className="w-5 h-5 text-[var(--hp-sub)]" />}
          title="Показов пока нет"
          description="Показ планируется с карточки сделки или объекта — клиент, объект и время подставятся сами, а приглашение уйдёт письмом."
          actionHref="/showings/new"
          actionLabel="Новый показ"
        />
      ) : (
        <ShowingsView showings={showings} />
      )}
    </div>
  )
}
