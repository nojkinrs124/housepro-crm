'use client'

import { useEffect, useRef, useState } from 'react'
import { FileCheck2, Wallet } from 'lucide-react'
import {
 type SubleaseExtraData,
 SUBLEASE_EXTRA_DEFAULTS,
 toSubleaseDefaults,
} from '../utils/sublease-data'

export type { SubleaseExtraData }

const DEFAULTS = SUBLEASE_EXTRA_DEFAULTS

interface Props {
 defaultValue?: unknown
}

const inp = 'w-full h-10 px-4 border border-input bg-background text-sm outline-none focus:border-[var(--hp-ink)] transition-all'
const lbl = 'block text-sm font-medium text-foreground mb-1.5'
const sectionTitle = 'font-semibold text-foreground flex items-center gap-2'

export function SubleaseExtraFields({ defaultValue }: Props) {
 const [data, setData] = useState<SubleaseExtraData>(() => ({
 ...DEFAULTS,
 ...toSubleaseDefaults(defaultValue),
 }))
 const hiddenRef = useRef<HTMLInputElement>(null)

 useEffect(() => {
 if (hiddenRef.current) hiddenRef.current.value = JSON.stringify(data)
 }, [data])

 const set = <K extends keyof SubleaseExtraData>(key: K, value: SubleaseExtraData[K]) =>
 setData(prev => ({ ...prev, [key]: value }))

 return (
 <div className="space-y-4">
 <input ref={hiddenRef} type="hidden" name="contract_type_data_json" defaultValue={JSON.stringify(data)} />

 <div className="hp-card p-6 space-y-4">
 <h2 className={sectionTitle}><FileCheck2 className="w-4 h-4 text-blue-500" /> Согласие собственника</h2>
 <p className="text-xs text-muted-foreground -mt-2">
 Ссылается на договор-основание, выбранный в блоке «Стороны договора» выше.
 </p>

 <label className="flex items-center gap-2 text-sm font-medium">
 <input type="checkbox" checked={data.owner_consent_given}
 onChange={e => set('owner_consent_given', e.target.checked)} className="accent-primary" />
 Письменное согласие собственника на субаренду получено
 </label>

 {data.owner_consent_given && (
 <div>
 <label className={lbl}>Реквизиты документа-согласия</label>
 <input className={inp} placeholder="например, Согласие от 01.03.2026 № 12"
 value={data.owner_consent_document}
 onChange={e => set('owner_consent_document', e.target.value)} />
 </div>
 )}
 </div>

 <div className="hp-card p-6 space-y-4">
 <h2 className={sectionTitle}><Wallet className="w-4 h-4 text-emerald-500" /> Коммунальные платежи и неустойка</h2>

 <label className="flex items-center gap-2 text-sm font-medium">
 <input type="checkbox" checked={data.utilities_included_in_rent}
 onChange={e => set('utilities_included_in_rent', e.target.checked)} className="accent-primary" />
 Коммунальные услуги включены в субарендную плату
 </label>
 <div>
 <label className={lbl}>Перечень услуг, оплачиваемых субарендатором отдельно</label>
 <input className={inp} value={data.utilities_paid_by_tenant}
 onChange={e => set('utilities_paid_by_tenant', e.target.value)} />
 </div>

 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className={lbl}>Неустойка за просрочку возврата (₽/день)</label>
 <input className={inp} type="number" min={0} value={data.late_return_penalty_per_day}
 onChange={e => set('late_return_penalty_per_day', e.target.value)} />
 </div>
 <div>
 <label className={lbl}>Количество экземпляров договора</label>
 <input className={inp} type="number" min={1} value={data.copies_count}
 onChange={e => set('copies_count', e.target.value)} />
 </div>
 </div>
 </div>
 </div>
 )
}
