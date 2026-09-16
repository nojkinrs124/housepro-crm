import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { deleteTransactionAction } from '@/features/accounting/actions/accounting.actions'
import { ConfirmDeleteButton } from '@/components/forms/ConfirmDeleteButton'
import { RecordActions } from '@/components/layout/RecordActions'
import { Pencil, FileText, TrendingUp, User, Users } from 'lucide-react'
import { DEAL_TYPE_LABELS } from '@/features/deals/config/deal-stages'
import { CONTRACT_TYPE_LABELS } from '@/features/contracts/config/contract-types'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { ReadinessPanel } from '@/components/layout/ReadinessPanel'
import { checkTransaction } from '@/lib/readiness'
import type { Row } from '@/types/database'

/** Операция со связями — ровно те поля, что перечислены в select ниже. */
type TransactionDetail = Pick<
  Row<'accounting_transactions'>,
  'id' | 'type' | 'amount' | 'date' | 'description' | 'status' | 'payment_method'
  | 'due_date' | 'created_at' | 'legacy_payment_id' | 'property_id' | 'category_id'
> & {
  category: { id: string; name: string; color: string } | null
  contract: { id: string; contract_number: string | null; contract_type: string } | null
  deal: { id: string; deal_type: string } | null
  contact: { id: string; full_name: string } | null
  employee: { id: string; full_name: string } | null
}

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
 completed: { label: 'Выполнено', cls: 'hp-badge-good' },
 planned: { label: 'Запланировано', cls: 'hp-badge-warn' },
 cancelled: { label: 'Отменено', cls: 'hp-badge-neutral' },
}
const METHOD_LABEL: Record<string, string> = {
 cash: 'Наличные', bank: 'Безналичный', card: 'Карта', other: 'Другое',
}

function fmt(n: number) { return n.toLocaleString('ru-RU') + ' ₽' }
function fmtDate(d: string) {
 return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default async function TransactionDetailPage({
 params,
}: {
 params: Promise<{ id: string }>
}) {
 const { id } = await params
 const supabase = await createClient()

 const { data: raw, error: rawError } = await supabase
 .from('accounting_transactions')
 .select(`
 id, type, amount, date, description, status, payment_method, due_date,
 created_at, legacy_payment_id, property_id, category_id,
 category:accounting_categories(id, name, color),
 contract:contracts(id, contract_number, contract_type),
 deal:deals(id, deal_type),
 contact:contacts(id, full_name),
 employee:users(id, full_name)
 `)
 .eq('id', id)
 .single()

 if (rawError && rawError.code !== 'PGRST116') {
 throw new Error(`Не удалось загрузить операцию: ${rawError.message}`)
 }
 if (!raw) notFound()
 const t = raw as TransactionDetail

 const issues = checkTransaction(t)

 const isIncome = t.type === 'income'
 const sc = STATUS_CFG[t.status] ?? STATUS_CFG.completed

 return (
 <div className="max-w-4xl mx-auto space-y-5">
 <PageHeader
 crumbs={[{ label: 'Бухгалтерия', href: '/accounting' }, { label: isIncome ? 'Доход' : 'Расход' }]}
 title={`${isIncome ? '+' : '−'}${fmt(Number(t.amount))}`}
 badges={
 <span className="flex items-center gap-1.5 flex-wrap">
 <span className={`hp-badge ${sc.cls}`}>{sc.label}</span>
 <span className={`hp-badge ${isIncome ? 'hp-badge-good' : 'hp-badge-danger'}`}>{isIncome ? 'Доход' : 'Расход'}</span>
 </span>
 }
 meta={
 <>
 <span>{fmtDate(t.date)}</span>
 {t.category && (<><span className="sep">·</span><span>{t.category.name}</span></>)}
 {t.payment_method && (<><span className="sep">·</span><span>{METHOD_LABEL[t.payment_method] ?? t.payment_method}</span></>)}
 </>
 }
 actions={
 <RecordActions
 secondary={
 <Link href={`/accounting/transactions/${id}/edit`} className="hp-btn-secondary">
 <Pencil className="w-4 h-4" />
 Редактировать
 </Link>
 }
 more={
 <ConfirmDeleteButton
 action={deleteTransactionAction.bind(null, id)}
 confirmText="Удалить операцию? Она пропадёт из отчёта и доходности объекта — отменить нельзя."
 label="Удалить операцию"
 redirectTo="/accounting"
 />
 }
 />
 }
 />

 <ReadinessPanel issues={issues} />

 <div className="grid lg:grid-cols-3 gap-4 items-start">
 <div className="lg:col-span-2 space-y-4">
 <div className="hp-block">
 <div className="hp-block-header">Операция</div>
 <div className="hp-block-grid">
 <div className="hp-block-row"><span className="label">Сумма</span><span className={`value${isIncome ? ' good' : ' danger'}`}>{fmt(Number(t.amount))}</span></div>
 <div className="hp-block-row"><span className="label">Дата</span><span className="value">{fmtDate(t.date)}</span></div>
 <div className="hp-block-row"><span className="label">Срок оплаты</span><span className="value">{t.due_date ? fmtDate(t.due_date) : <span className="text-[var(--hp-tertiary)]">—</span>}</span></div>
 <div className="hp-block-row"><span className="label">Способ оплаты</span><span className="value">{t.payment_method ? (METHOD_LABEL[t.payment_method] ?? t.payment_method) : <span className="text-[var(--hp-tertiary)]">—</span>}</span></div>
 <div className="hp-block-row"><span className="label">Категория</span><span className="value">{t.category ? t.category.name : <span className="text-[var(--hp-tertiary)]">без категории</span>}</span></div>
 <div className="hp-block-row"><span className="label">Создана</span><span className="value">{t.created_at ? fmtDate(t.created_at) : '—'}</span></div>
 </div>
 </div>
 {t.description && (
 <div className="hp-block">
 <div className="hp-block-header">Описание</div>
 <p className="px-[18px] py-3 text-sm text-[var(--hp-sub)] whitespace-pre-wrap leading-relaxed">{t.description}</p>
 </div>
 )}
 </div>

 <div className="space-y-4">
 <div className="hp-block">
 <div className="hp-block-header">Связано с</div>
 {!(t.contract || t.deal || t.employee || t.contact) && (
 <div className="hp-block-item text-[var(--hp-tertiary)]">Операция ни к чему не привязана</div>
 )}
 {t.contract && (
 <Link href={`/contracts/${t.contract.id}`} className="hp-block-item">
 <FileText className="w-4 h-4 shrink-0 text-[var(--hp-sub)]" />
 <span className="flex-1 min-w-0">
 <span className="block truncate text-[var(--hp-ink)] font-medium">{CONTRACT_TYPE_LABELS[t.contract.contract_type] ?? t.contract.contract_type}</span>
 <span className="block text-[11.5px] text-[var(--hp-sub)]">{t.contract.contract_number ? `№ ${t.contract.contract_number}` : 'без номера'}</span>
 </span>
 </Link>
 )}
 {t.deal && (
 <Link href={`/deals/${t.deal.id}`} className="hp-block-item">
 <TrendingUp className="w-4 h-4 shrink-0 text-[var(--hp-sub)]" />
 <span className="flex-1 min-w-0 truncate text-[var(--hp-ink)] font-medium">{DEAL_TYPE_LABELS[t.deal.deal_type] ?? t.deal.deal_type}</span>
 </Link>
 )}
 {t.contact && (
 <Link href={`/contacts/${t.contact.id}`} className="hp-block-item">
 <User className="w-4 h-4 shrink-0 text-[var(--hp-sub)]" />
 <span className="flex-1 min-w-0 truncate text-[var(--hp-ink)] font-medium">{t.contact.full_name}</span>
 </Link>
 )}
 {t.employee && (
 <Link href={`/employees/${t.employee.id}`} className="hp-block-item">
 <Users className="w-4 h-4 shrink-0 text-[var(--hp-sub)]" />
 <span className="flex-1 min-w-0 truncate text-[var(--hp-ink)] font-medium">{t.employee.full_name}</span>
 </Link>
 )}
 </div>
 </div>
 </div>
 </div>
 )
}
