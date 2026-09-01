import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, List, Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import {
 ShowingsCalendar,
 monthRange,
 parseMonth,
 type CalendarShowing,
} from '@/features/showings/components/ShowingsCalendar'

export const dynamic = 'force-dynamic'

interface ShowingRow {
 id: string
 scheduled_at: string
 status: string
 duration_min: number | null
 property: { title: string | null; address: string | null } | null
 contact: { full_name: string | null } | null
 agent: { full_name: string | null } | null
}

export default async function ShowingsCalendarPage({
 searchParams,
}: {
 searchParams: Promise<{ month?: string }>
}) {
 const { month: monthParam } = await searchParams
 const supabase = await createClient()
 const { data: { user } } = await supabase.auth.getUser()
 if (!user) redirect('/login')

 const month = parseMonth(monthParam)
 const { from, to } = monthRange(month)

 const { data } = await supabase
 .from('showings')
 .select(`
 id, scheduled_at, status, duration_min,
 property:properties(title, address),
 contact:contacts(full_name),
 agent:users!showings_agent_id_fkey(full_name)
 `)
 .gte('scheduled_at', from)
 .lt('scheduled_at', to)
 .order('scheduled_at', { ascending: true })
 .limit(500)

 const showings: CalendarShowing[] = ((data ?? []) as unknown as ShowingRow[]).map((row) => ({
 id: row.id,
 scheduled_at: row.scheduled_at,
 status: row.status,
 duration_min: row.duration_min,
 propertyTitle: row.property?.title ?? row.property?.address ?? null,
 contactName: row.contact?.full_name ?? null,
 agentName: row.agent?.full_name ?? null,
 }))

 return (
 <div className="space-y-6">
 <PageHeader
 title="Календарь показов"
 subtitle={`${showings.length} показов в этом месяце`}
 iconBg="bg-[var(--hp-neutral-tint)]"
 icon={<CalendarDays className="text-[var(--hp-ink)]" style={{ width: 20, height: 20 }} />}
 actions={
 <>
 <Link
 href="/showings"
 className="flex items-center gap-2 px-4 py-2 border border-[var(--hp-border)] rounded-[var(--hp-radius)] text-sm font-medium text-[var(--hp-ink)] hover:border-[var(--hp-sub)] transition-colors whitespace-nowrap"
 >
 <List className="w-4 h-4" />
 Списком
 </Link>
 <Link
 href="/showings/new"
 className="flex items-center gap-2 px-5 py-2.5 text-white rounded-[var(--hp-radius)] text-sm font-semibold transition-colors bg-[var(--hp-accent)] hover:bg-[var(--hp-accent-hover)] whitespace-nowrap"
 >
 <Plus className="w-4 h-4" />
 Новый показ
 </Link>
 </>
 }
 />

 <ShowingsCalendar month={month} showings={showings} />

 <p className="text-xs text-[var(--hp-sub)]">
 Чтобы показы появлялись в календаре телефона, подключите подписку в{' '}
 <Link href="/settings/profile" className="underline">профиле</Link>.
 </p>
 </div>
 )
}
