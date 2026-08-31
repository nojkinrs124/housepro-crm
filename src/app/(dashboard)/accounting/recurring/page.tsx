import { createClient } from '@/lib/supabase/server'
import { DeleteRecurringButton } from '@/features/accounting/components/DeleteRecurringButton'
import { GenerateRecurringButton } from '@/features/accounting/components/GenerateRecurringButton'
import { Plus, RefreshCw, Pencil } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { buttonVariants } from '@/components/ui/button'

const FREQ_LABEL: Record<string, string> = {
 daily: 'Ежедневно', weekly: 'Еженедельно',
 monthly: 'Ежемесячно', yearly: 'Ежегодно',
}

function fmt(n: number) { return n.toLocaleString('ru-RU') + ' ₽' }
function fmtDate(d: string) {
 return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default async function RecurringPage() {
 const supabase = await createClient()
 const { data: raw } = await supabase
 .from('accounting_recurring_rules')
 .select(`
 id, name, type, amount, frequency, day_of_month,
 start_date, end_date, is_active, last_generated_date,
 category:accounting_categories(name, color),
 employee:users(id, full_name)
 `)
 .order('is_active', { ascending: false })
 .order('created_at', { ascending: false })

 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const rules = (raw ?? []) as any[]
 const active = rules.filter(r => r.is_active)
 const inactive = rules.filter(r => !r.is_active)

 return (
 <div className="space-y-6">
 <PageHeader
 title="Периодические операции"
 subtitle="Аренда офиса, зарплаты, подписки — автоматически создаются транзакции"
 backHref="/accounting"
 backLabel="Бухгалтерия"
 actions={
 <div className="flex items-center gap-2 flex-wrap">
 <GenerateRecurringButton />
 <Link href="/accounting/recurring/new" className={buttonVariants({ size: 'lg' })}>
 <Plus className="w-4 h-4" />
 Добавить
 </Link>
 </div>
 }
 />

 {rules.length === 0 ? (
 <div
 className="hp-card py-16 text-center"
 style={{ }}
 >
 <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
 <RefreshCw style={{ width: 20, height: 20 }} className="text-[var(--hp-tertiary)]" />
 </div>
 <p className="text-[var(--hp-ink)] font-semibold">Нет периодических операций</p>
 <Link
 href="/accounting/recurring/new"
 className="mt-2 inline-block text-sm text-green-600 hover:underline font-medium"
 >
 Добавить первую →
 </Link>
 </div>
 ) : (
 <>
 {/* Active */}
 {active.length > 0 && (
 <div
 className="hp-card"
 style={{ }}
 >
 <div className="px-5 pt-5 pb-4 border-b border-[var(--hp-border-soft)] flex items-center gap-2">
 <span className="w-2 h-2 rounded-full bg-green-500" />
 <h2 className="font-bold text-foreground text-[15px]">Активные</h2>
 <span className="text-xs text-muted-foreground font-medium ml-1">{active.length}</span>
 </div>
 <div className="divide-y divide-[var(--hp-border-soft)]">
 {active.map(r => (
 <RuleRow key={r.id} rule={r} />
 ))}
 </div>
 </div>
 )}

 {/* Inactive */}
 {inactive.length > 0 && (
 <div
 className="hp-card"
 style={{ }}
 >
 <div className="px-5 pt-5 pb-4 border-b border-[var(--hp-border-soft)] flex items-center gap-2">
 <span className="w-2 h-2 rounded-full bg-slate-300" />
 <h2 className="font-bold text-foreground text-[15px]">Приостановлены</h2>
 <span className="text-xs text-muted-foreground font-medium ml-1">{inactive.length}</span>
 </div>
 <div className="divide-y divide-[var(--hp-border-soft)]">
 {inactive.map(r => (
 <RuleRow key={r.id} rule={r} />
 ))}
 </div>
 </div>
 )}
 </>
 )}
 </div>
 )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RuleRow({ rule: r }: { rule: any }) {
 const isIncome = r.type === 'income'

 function fmt(n: number) { return n.toLocaleString('ru-RU') + ' ₽' }
 function fmtDate(d: string) {
 return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })
 }

 return (
 <div className="flex items-center gap-4 px-5 py-4 flex-wrap">
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <p className="text-sm font-bold text-foreground">{r.name}</p>
 {r.employee?.full_name && (
 <span className="text-xs text-muted-foreground font-medium">· {r.employee.full_name}</span>
 )}
 </div>
 <div className="flex items-center gap-3 mt-1 flex-wrap">
 <span className="text-xs text-[var(--hp-tertiary)]">
 {FREQ_LABEL[r.frequency] ?? r.frequency}
 {r.day_of_month ? ` (${r.day_of_month}-го)` : ''}
 </span>
 {r.category && (
 <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
 <span className="w-1.5 h-1.5 rounded-full" style={{ background: r.category.color }} />
 {r.category.name}
 </span>
 )}
 <span className="text-xs text-[var(--hp-tertiary)]">
 c {fmtDate(r.start_date)}{r.end_date ? ` по ${fmtDate(r.end_date)}` : ''}
 </span>
 </div>
 </div>
 <div className="shrink-0 text-right">
 <p className={`text-base font-bold ${isIncome ? 'text-green-700' : 'text-red-600'}`}>
 {isIncome ? '+' : '−'}{fmt(Number(r.amount))}
 </p>
 {r.last_generated_date && (
 <p className="text-xs text-[var(--hp-tertiary)] mt-0.5">
 Последний: {fmtDate(r.last_generated_date)}
 </p>
 )}
 </div>
 <div className="flex items-center gap-1 shrink-0">
 <Link
 href={`/accounting/recurring/${r.id}/edit`}
 className="p-1.5 text-[var(--hp-tertiary)] hover:text-green-600 hover:bg-green-50 transition-colors"
 title="Редактировать"
 >
 <Pencil style={{ width: 14, height: 14 }} />
 </Link>
 <DeleteRecurringButton id={r.id} />
 </div>
 </div>
 )
}
