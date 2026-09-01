'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, ShieldCheck } from 'lucide-react'
import { checkCounterpartyAction } from '../actions/counterparty.actions'
import {
 describeCounterpartyStatus,
 type CounterpartySnapshot,
} from '../config/counterparty'

/**
 * Проверка контрагента по ЕГРЮЛ на карточке юрлица.
 *
 * Показывает снимок последней проверки — дату, статус, руководителя. Именно
 * дата важна: «должная осмотрительность» доказывается тем, что на момент
 * сделки контрагент был действующим, а не тем, каков он сейчас.
 */
export function CounterpartyCheckPanel({
 contactId,
 initialSnapshot,
 checkedAt,
}: {
 contactId: string
 initialSnapshot: CounterpartySnapshot | null
 checkedAt: string | null
}) {
 const [snapshot, setSnapshot] = useState<CounterpartySnapshot | null>(initialSnapshot)
 const [warnings, setWarnings] = useState<string[]>([])
 const [isPending, startTransition] = useTransition()

 function run() {
 startTransition(async () => {
 const res = await checkCounterpartyAction(contactId)
 if (res.error) {
 toast.error(res.error)
 return
 }
 setSnapshot(res.snapshot ?? null)
 setWarnings(res.warnings ?? [])
 toast.success('Проверка выполнена')
 })
 }

 const when = snapshot?.checkedAt ?? checkedAt
 const isActive = snapshot?.status === 'ACTIVE'

 return (
 <div className="hp-block">
 <div className="hp-block-header">Проверка контрагента</div>

 {snapshot ? (
 <>
 <div className="hp-block-row">
 <span className="label">Статус в ЕГРЮЛ</span>
 <span
 className="value"
 style={{ color: isActive ? 'var(--hp-good)' : 'var(--hp-danger)' }}
 >
 {describeCounterpartyStatus(snapshot.status)}
 </span>
 </div>
 <div className="hp-block-row">
 <span className="label">Наименование</span>
 <span className="value">{snapshot.name}</span>
 </div>
 {snapshot.managerName && (
 <div className="hp-block-row">
 <span className="label">Руководитель</span>
 <span className="value">
 {snapshot.managerName}
 {snapshot.managerPost ? `, ${snapshot.managerPost}` : ''}
 </span>
 </div>
 )}
 {snapshot.legalAddress && (
 <div className="hp-block-row">
 <span className="label">Адрес по ЕГРЮЛ</span>
 <span className="value">{snapshot.legalAddress}</span>
 </div>
 )}
 {when && (
 <div className="hp-block-row">
 <span className="label">Проверено</span>
 <span className="value">{new Date(when).toLocaleString('ru-RU')}</span>
 </div>
 )}
 </>
 ) : (
 <div className="px-[18px] py-3">
 <p className="text-sm text-[var(--hp-sub)]">
 Проверка ещё не проводилась. Запрос идёт в ЕГРЮЛ по ИНН из карточки.
 </p>
 </div>
 )}

 {warnings.length > 0 && (
 <div className="px-[18px] py-3 space-y-1.5">
 {warnings.map((warning) => (
 <p key={warning} className="flex items-start gap-2 text-sm text-[var(--hp-danger)]">
 <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
 {warning}
 </p>
 ))}
 </div>
 )}

 <div className="px-[18px] py-3">
 <button
 type="button"
 onClick={run}
 disabled={isPending}
 className="flex items-center gap-2 px-4 py-2 border border-[var(--hp-border)] rounded-[var(--hp-radius)] text-sm font-medium text-[var(--hp-ink)] hover:border-[var(--hp-sub)] transition-colors disabled:opacity-60"
 >
 <ShieldCheck className="w-4 h-4" />
 {isPending ? 'Проверяем…' : snapshot ? 'Проверить заново' : 'Проверить в ЕГРЮЛ'}
 </button>
 </div>
 </div>
 )
}
