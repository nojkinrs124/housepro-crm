import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { buttonVariants } from '@/components/ui/button'
import {
  CalendarMonth, monthRange, parseMonth, TONE_COLOR,
  type CalendarEvent, type EventKind,
} from '@/features/calendar/components/CalendarMonth'
import { formatAmount } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/**
 * Общий календарь агентства: показы, дедлайны задач и плановые платежи в одной
 * месячной сетке. Раньше календарь был только у показов и лежал внутри их
 * раздела — остальные даты CRM нигде не сходились.
 */

/**
 * «Управление» — не отдельный тип события, а срез платежей: только по объектам
 * в доверительном управлении. Объект с платежом связан через договор
 * (transactions.contract_id → contracts.property_id), прямой ссылки нет.
 */
type Filter = EventKind | 'all' | 'management'

const KINDS: { value: Filter; label: string }[] = [
  { value: 'all',        label: 'Все события' },
  { value: 'showing',    label: 'Показы' },
  { value: 'task',       label: 'Задачи' },
  { value: 'payment',    label: 'Платежи' },
  { value: 'management', label: 'Управление' },
]

interface PaymentContract {
  contract_number: string | null
  contract_type: string
  property: { title: string | null; address: string | null; deal_type: string } | null
}

/** Платёж относится к управлению, если таков договор или сам объект под ним. */
function isManagement(contract: PaymentContract | null): boolean {
  if (!contract) return false
  return contract.contract_type === 'property_management'
    || contract.property?.deal_type === 'management'
}

const SHOWING_TONE: Record<string, CalendarEvent['tone']> = {
  planned: 'info', completed: 'good', cancelled: 'neutral', no_show: 'danger',
}

const LEGEND: { tone: CalendarEvent['tone']; label: string }[] = [
  { tone: 'info',    label: 'Показ запланирован' },
  { tone: 'good',    label: 'Проведён / выполнено' },
  { tone: 'warn',    label: 'Задача или платёж в срок' },
  { tone: 'danger',  label: 'Просрочено' },
  { tone: 'neutral', label: 'Отменено' },
]

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; kind?: string }>
}) {
  const { month: monthParam, kind: kindParam } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const month = parseMonth(monthParam)
  const { from, to, fromDay, toDay } = monthRange(month)
  const kind: Filter = KINDS.some(k => k.value === kindParam) ? (kindParam as Filter) : 'all'
  const wants = (k: EventKind) =>
    kind === 'all' || kind === k || (k === 'payment' && kind === 'management')

  // Имя агента здесь не нужно, и это к лучшему: showings.agent_id ссылается на
  // auth.users, join users!showings_agent_id_fkey роняет весь запрос (PGRST200).
  const [showings, tasks, payments] = await Promise.all([
    wants('showing')
      ? supabase.from('showings')
          .select('id, scheduled_at, status, property:properties(title, address), contact:contacts(full_name)')
          .gte('scheduled_at', from).lt('scheduled_at', to)
          .order('scheduled_at').limit(500)
      : Promise.resolve({ data: [] }),
    wants('task')
      ? supabase.from('tasks')
          .select('id, title, deadline, status, priority')
          .not('deadline', 'is', null)
          .gte('deadline', from).lt('deadline', to)
          .order('deadline').limit(500)
      : Promise.resolve({ data: [] }),
    wants('payment')
      ? supabase.from('accounting_transactions')
          .select(`id, due_date, amount, type, status, description,
                   contract:contracts(contract_number, contract_type,
                                      property:properties(title, address, deal_type))`)
          .not('due_date', 'is', null)
          .gte('due_date', fromDay).lt('due_date', toDay)
          .order('due_date').limit(500)
      : Promise.resolve({ data: [] }),
  ])

  const now = new Date()
  const events: CalendarEvent[] = []

  for (const s of showings.data ?? []) {
    const property = s.property as { title: string | null; address: string | null } | null
    const contact = s.contact as { full_name: string | null } | null
    events.push({
      id: s.id,
      kind: 'showing',
      at: s.scheduled_at,
      title: property?.title ?? property?.address ?? contact?.full_name ?? 'Показ',
      href: `/showings/${s.id}`,
      tone: SHOWING_TONE[s.status] ?? 'neutral',
    })
  }

  for (const t of tasks.data ?? []) {
    const done = t.status === 'done' || t.status === 'cancelled'
    const overdue = !done && t.deadline !== null && new Date(t.deadline) < now
    events.push({
      id: t.id,
      kind: 'task',
      at: t.deadline as string,
      title: t.title,
      href: `/tasks/${t.id}`,
      tone: done ? (t.status === 'done' ? 'good' : 'neutral') : overdue ? 'danger' : 'warn',
      allDay: true,
    })
  }

  for (const p of payments.data ?? []) {
    const contract = p.contract as PaymentContract | null
    const management = isManagement(contract)
    if (kind === 'management' && !management) continue

    const overdue = p.status === 'planned' && p.due_date !== null && new Date(p.due_date) < now
    const sign = p.type === 'income' ? '+' : '−'
    const amount = `${sign}${formatAmount(Number(p.amount))} ₽`
    // В срезе управления важнее объект, чем назначение платежа
    const label = management
      ? contract?.property?.title ?? contract?.property?.address ?? p.description
      : p.description

    events.push({
      id: p.id,
      kind: 'payment',
      at: `${p.due_date}T00:00:00.000Z`,
      title: `${amount}${label ? ` · ${label}` : ''}`,
      href: `/accounting/transactions/${p.id}`,
      tone: p.status === 'completed' ? 'good' : p.status === 'cancelled' ? 'neutral' : overdue ? 'danger' : 'warn',
      allDay: true,
    })
  }

  const buildHref = (value: Filter) => {
    const params = new URLSearchParams()
    if (monthParam) params.set('month', monthParam)
    if (value !== 'all') params.set('kind', value)
    const qs = params.toString()
    return `/calendar${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Календарь"
        subtitle={`${events.length} событий в этом месяце`}
        iconBg="bg-[var(--hp-neutral-tint)]"
        icon={<CalendarDays className="text-[var(--hp-ink)]" style={{ width: 20, height: 20 }} />}
        actions={
          <Link href="/showings/new" className={buttonVariants({ size: 'sm' })}>
            <Plus style={{ width: 16, height: 16 }} />
            Новый показ
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {KINDS.map(k => (
          <Link key={k.value} href={buildHref(k.value)} className={`hp-chip${kind === k.value ? ' active' : ''}`}>
            {k.label}
          </Link>
        ))}
      </div>

      <CalendarMonth
        month={month}
        events={events}
        basePath="/calendar"
        query={{ kind: kind === 'all' ? undefined : kind }}
      />

      <div className="flex items-center gap-4 flex-wrap text-xs text-[var(--hp-sub)]">
        {LEGEND.map(item => (
          <span key={item.tone} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: TONE_COLOR[item.tone] }} />
            {item.label}
          </span>
        ))}
      </div>

      <p className="text-xs text-[var(--hp-sub)]">
        Чтобы показы появлялись в календаре телефона, подключите подписку в{' '}
        <Link href="/settings/profile" className="underline">профиле</Link>.
      </p>
    </div>
  )
}
