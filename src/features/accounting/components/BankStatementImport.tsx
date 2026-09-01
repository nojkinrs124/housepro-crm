'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { AlertCircle, CheckCircle2, Upload } from 'lucide-react'
import {
 applyBankStatementAction,
 parseBankStatementAction,
 type BankStatementRow,
 type ParseStatementResult,
} from '../actions/bank-import.actions'

function fmtMoney(value: number): string {
 return `${value.toLocaleString('ru-RU')} ₽`
}

function fmtDate(iso: string | null): string {
 if (!iso) return '—'
 return new Date(`${iso}T00:00:00Z`).toLocaleDateString('ru-RU', { timeZone: 'UTC' })
}

/**
 * Сверка банковской выписки с плановыми начислениями.
 *
 * Автоматически отмечаются только уверенные совпадения (сумма + номер договора
 * или ИНН плательщика). Совпадения «только по сумме» показываются, но галочка
 * по ним снята: ошибочно закрытый чужой платёж потом ищут неделями.
 */
export function BankStatementImport() {
 const [parsed, setParsed] = useState<ParseStatementResult | null>(null)
 const [selected, setSelected] = useState<Set<number>>(new Set())
 const [isApplying, startApply] = useTransition()
 const [done, setDone] = useState<number | null>(null)

 const [state, formAction, isPending] = useActionState(
 async (_prev: ParseStatementResult | null, formData: FormData) =>
 parseBankStatementAction(_prev, formData),
 null
 )

 useEffect(() => {
 if (!state) return
 setParsed(state)
 setDone(null)
 if (state.rows) {
 setSelected(
 new Set(
 state.rows
 .filter((r) => r.match?.confidence === 'exact')
 .map((r) => r.index)
 )
 )
 }
 }, [state])

 function toggle(index: number) {
 setSelected((prev) => {
 const next = new Set(prev)
 if (next.has(index)) next.delete(index)
 else next.add(index)
 return next
 })
 }

 function apply() {
 const rows = parsed?.rows ?? []
 const items = rows
 .filter((r) => selected.has(r.index) && r.match)
 .map((r) => ({
 transactionId: r.match!.transactionId,
 paidOn: r.date,
 amount: r.amount,
 documentNumber: r.number,
 }))

 if (items.length === 0) {
 toast.error('Не выбрано ни одного платежа')
 return
 }

 startApply(async () => {
 const res = await applyBankStatementAction(items)
 if (res.error) {
 toast.error(res.error)
 return
 }
 toast.success(`Отмечено оплаченными: ${res.applied}`)
 setDone(res.applied ?? 0)
 setParsed(null)
 setSelected(new Set())
 })
 }

 const rows = parsed?.rows ?? []
 const matchedCount = rows.filter((r) => r.match).length

 return (
 <div className="space-y-6">
 <form action={formAction} className="hp-card p-5 space-y-4">
 <h2 className="font-bold text-[var(--hp-ink)] text-[15px]">Файл выписки</h2>
 <p className="text-sm text-[var(--hp-sub)]">
 В банк-клиенте выберите выгрузку в формате «1С:Предприятие» — получится текстовый файл
 (обычно <code className="px-1 bg-[var(--hp-neutral-tint)]">kl_to_1c.txt</code>). Формат
 поддерживают Сбербанк Бизнес, Т-Бизнес, Альфа, Точка и другие.
 </p>

 <div className="flex items-center gap-3 flex-wrap">
 <input
 type="file"
 name="file"
 accept=".txt,.1c,text/plain"
 required
 className="text-sm text-[var(--hp-ink)] file:mr-3 file:px-4 file:py-2 file:border file:border-[var(--hp-border)] file:bg-[var(--hp-surface)] file:text-sm file:font-semibold file:text-[var(--hp-ink)]"
 />
 <button
 type="submit"
 disabled={isPending}
 className="flex items-center gap-2 px-5 py-2.5 text-white rounded-[var(--hp-radius)] text-sm font-semibold transition-colors bg-[var(--hp-accent)] hover:bg-[var(--hp-accent-hover)] disabled:opacity-60"
 >
 <Upload className="w-4 h-4" />
 {isPending ? 'Разбираем…' : 'Загрузить выписку'}
 </button>
 </div>
 </form>

 {parsed?.error && (
 <div className="flex items-start gap-2 border border-[var(--hp-border)] bg-[var(--hp-danger-tint)] px-4 py-3 text-sm text-[var(--hp-danger)]">
 <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
 {parsed.error}
 </div>
 )}

 {done !== null && (
 <div className="hp-card p-5 flex items-center gap-2">
 <CheckCircle2 className="w-4 h-4 text-[var(--hp-good)]" />
 <p className="text-sm text-[var(--hp-ink)]">
 Готово: отмечено оплаченными {done} начислений.
 </p>
 </div>
 )}

 {rows.length > 0 && (
 <div className="hp-card p-5 space-y-4">
 <div className="flex items-center gap-2 flex-wrap">
 <h2 className="font-bold text-[var(--hp-ink)] text-[15px]">
 Входящие платежи — {rows.length}
 </h2>
 <span className="hp-badge hp-badge-good">сопоставлено {matchedCount}</span>
 {(parsed?.unmatched ?? 0) > 0 && (
 <span className="hp-badge hp-badge-warn">без пары {parsed?.unmatched}</span>
 )}
 {parsed?.account && (
 <span className="text-xs text-[var(--hp-sub)]">счёт {parsed.account}</span>
 )}
 </div>

 <div className="overflow-x-auto">
 <table className="w-full text-sm min-w-[720px]">
 <thead>
 <tr className="bg-[var(--hp-neutral-tint)]">
 <th className="px-3 py-2 w-8" />
 <th className="px-3 py-2 text-left font-semibold text-[var(--hp-ink)]">Дата</th>
 <th className="px-3 py-2 text-left font-semibold text-[var(--hp-ink)]">Плательщик</th>
 <th className="px-3 py-2 text-right font-semibold text-[var(--hp-ink)]">Сумма</th>
 <th className="px-3 py-2 text-left font-semibold text-[var(--hp-ink)]">Начисление</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-[var(--hp-border-soft)]">
 {rows.map((row: BankStatementRow) => (
 <tr key={row.index} className={row.match ? '' : 'opacity-70'}>
 <td className="px-3 py-2 align-top">
 <input
 type="checkbox"
 checked={selected.has(row.index)}
 disabled={!row.match}
 onChange={() => toggle(row.index)}
 />
 </td>
 <td className="px-3 py-2 align-top whitespace-nowrap text-[var(--hp-ink)]">
 {fmtDate(row.date)}
 {row.number && (
 <span className="block text-xs text-[var(--hp-sub)]">№ {row.number}</span>
 )}
 </td>
 <td className="px-3 py-2 align-top text-[var(--hp-ink)]">
 <span className="block break-words">{row.payerName ?? '—'}</span>
 {row.purpose && (
 <span className="block text-xs text-[var(--hp-sub)] break-words">{row.purpose}</span>
 )}
 </td>
 <td className="px-3 py-2 align-top text-right whitespace-nowrap font-semibold text-[var(--hp-ink)]">
 {fmtMoney(row.amount)}
 </td>
 <td className="px-3 py-2 align-top">
 {row.match ? (
 <>
 <span className="block text-[var(--hp-ink)] break-words">
 {row.match.description ?? 'Начисление'}
 </span>
 <span className="block text-xs text-[var(--hp-sub)]">
 {row.match.contractNumber ? `договор ${row.match.contractNumber} · ` : ''}
 срок {fmtDate(row.match.dueDate)}
 </span>
 {row.match.confidence === 'amount' && (
 <span className="hp-badge hp-badge-warn mt-1">только по сумме — проверьте</span>
 )}
 </>
 ) : (
 <span className="text-[var(--hp-sub)]">пары не нашлось</span>
 )}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>

 <button
 type="button"
 onClick={apply}
 disabled={isApplying || selected.size === 0}
 className="px-5 py-2.5 text-white rounded-[var(--hp-radius)] text-sm font-semibold transition-colors bg-[var(--hp-accent)] hover:bg-[var(--hp-accent-hover)] disabled:opacity-50"
 >
 {isApplying ? 'Применяем…' : `Отметить оплаченными: ${selected.size}`}
 </button>
 </div>
 )}
 </div>
 )
}
