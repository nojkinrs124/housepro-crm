import { createClient } from '@/lib/supabase/server'
import { CompleteTransactionButton } from '@/features/accounting/components/CompleteTransactionButton'
import { DeleteContractTransactionButton } from '@/features/accounting/components/DeleteContractTransactionButton'
import { AddContractPaymentForm } from '@/features/accounting/components/AddContractPaymentForm'
import { CreditCard, FileText } from 'lucide-react'
import Link from 'next/link'
import { PaymentScheduleForm } from '@/features/accounting/components/PaymentScheduleForm'
import { PaymentLinkButton } from '@/features/accounting/components/PaymentLinkButton'

const statusConfig: Record<string, { label: string; className: string }> = {
 planned: { label: 'Ожидает', className: 'bg-[var(--hp-warn-tint)] text-[var(--hp-warn)]' },
 completed: { label: 'Оплачен', className: 'bg-[var(--hp-good-tint)] text-[var(--hp-good)]' },
 overdue: { label: 'Просрочен', className: 'bg-[var(--hp-danger-tint)] text-[var(--hp-danger)]' },
 cancelled: { label: 'Отменён', className: 'bg-[var(--hp-neutral-tint)] text-[var(--hp-sub)]' },
}

function fmt(n: number) {
 return n.toLocaleString('ru-RU') + ' ₽'
}

function fmtDate(d?: string | null) {
 if (!d) return '—'
 return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export async function PaymentsSection({ contractId }: { contractId: string }) {
 const supabase = await createClient()

 const [{ data: transactions }, { data: contract }] = await Promise.all([
 supabase
 .from('accounting_transactions')
 .select('id, amount, status, date, due_date, description, schedule_seq, payment_url')
 .eq('contract_id', contractId)
 .eq('type', 'income')
 .order('due_date', { ascending: true, nullsFirst: false }),
 supabase
 .from('contracts')
 .select('start_date, end_date, amount, deposit, indexation_percent, indexation_period_months')
 .eq('id', contractId)
 .maybeSingle(),
 ])

 const rows = transactions ?? []
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const scheduledCount = rows.filter((t: any) => t.schedule_seq !== null && t.schedule_seq !== undefined).length
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const totalPaid = rows.filter((t: any) => t.status === 'completed').reduce((s: number, t: any) => s + Number(t.amount), 0)
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const totalOwed = rows.filter((t: any) => t.status === 'planned').reduce((s: number, t: any) => s + Number(t.amount), 0)

 return (
 <div className="hp-card p-5 space-y-4">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <CreditCard className="w-4 h-4 text-muted-foreground" />
 <h2 className="font-semibold text-foreground">Платежи</h2>
 {rows.length > 0 && (
 <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-[var(--hp-radius-badge)]">
 {rows.length}
 </span>
 )}
 </div>
 <AddContractPaymentForm contractId={contractId} />
 </div>

 {/* Разворачивание договора в график: годовая аренда — это 12 одинаковых
 ручных форм, и любая опечатка в дате всплывала только при разборе просрочек. */}
 <PaymentScheduleForm
 contractId={contractId}
 startDate={contract?.start_date ?? null}
 endDate={contract?.end_date ?? null}
 amount={contract?.amount ?? null}
 deposit={contract?.deposit ?? null}
 indexationPercent={contract?.indexation_percent ?? null}
 indexationPeriodMonths={contract?.indexation_period_months ?? null}
 existingCount={scheduledCount}
 />

 {rows.length > 0 && (
 <div className="grid grid-cols-2 gap-3">
 <div className="bg-[var(--hp-good-tint)] p-3">
 <p className="text-xs text-[var(--hp-good)] mb-0.5">Получено</p>
 <p className="text-sm font-bold text-[var(--hp-good)]">{fmt(totalPaid)}</p>
 </div>
 <div className="bg-[var(--hp-warn-tint)] p-3">
 <p className="text-xs text-[var(--hp-warn)] mb-0.5">Ожидается</p>
 <p className="text-sm font-bold text-[var(--hp-warn)]">{fmt(totalOwed)}</p>
 </div>
 </div>
 )}

 {rows.length === 0 ? (
 <p className="text-sm text-muted-foreground">Платежей нет</p>
 ) : (
 <div className="space-y-2">
 {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
 {rows.map((t: any) => {
 const isOverdue = t.status === 'planned' && t.due_date && new Date(t.due_date) < new Date()
 const statusKey = isOverdue ? 'overdue' : t.status
 const sc = statusConfig[statusKey] ?? statusConfig.planned

 return (
 <div key={t.id} className="flex items-center gap-3 p-3 hover:bg-accent/40 transition-colors group">
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <p className="text-sm font-semibold text-foreground">{fmt(Number(t.amount))}</p>
 <span className={`text-xs px-2 py-0.5 rounded-[var(--hp-radius-badge)] font-medium ${sc.className}`}>
 {sc.label}
 </span>
 </div>
 <p className="text-xs text-muted-foreground mt-0.5">
 {t.due_date ? `срок ${fmtDate(t.due_date)}` : ''}
 {t.status === 'completed' ? ` · оплачен ${fmtDate(t.date)}` : ''}
 </p>
 {t.description && <p className="text-xs text-muted-foreground truncate">{t.description}</p>}
 </div>
 <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
 <Link
 href={`/accounting/invoice/${t.id}`}
 title="Счёт на оплату"
 className="p-1.5 text-[var(--hp-sub)] hover:text-[var(--hp-ink)] hover:bg-[var(--hp-neutral-tint)] transition-colors"
 >
 <FileText className="w-4 h-4" />
 </Link>
 <PaymentLinkButton transactionId={t.id} status={t.status} existingUrl={t.payment_url} />
 <CompleteTransactionButton transactionId={t.id} status={t.status} />
 <DeleteContractTransactionButton transactionId={t.id} />
 </div>
 </div>
 )
 })}
 </div>
 )}
 </div>
 )
}
