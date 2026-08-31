'use client'

import { useEffect, useRef, useState } from 'react'
import { ListChecks, Percent, Wallet } from 'lucide-react'
import {
 type AgencyServiceExtraData,
 AGENCY_SERVICE_EXTRA_DEFAULTS,
 AGENCY_SERVICE_OPTIONS,
 REWARD_MODEL_LABELS,
 PAYMENT_TERMS_LABELS,
 toAgencyServiceDefaults,
 type RewardModel,
 type PaymentTerms,
} from '../utils/agency-service-data'

export type { AgencyServiceExtraData }

const DEFAULTS = AGENCY_SERVICE_EXTRA_DEFAULTS

interface Props {
 defaultValue?: unknown
}

const inp = 'w-full h-10 px-4 border border-input bg-background text-sm outline-none focus:border-[var(--hp-ink)] transition-all'
const sel = inp + ' cursor-pointer'
const lbl = 'block text-sm font-medium text-foreground mb-1.5'
const sectionTitle = 'font-semibold text-foreground flex items-center gap-2'

export function AgencyServiceExtraFields({ defaultValue }: Props) {
 const [data, setData] = useState<AgencyServiceExtraData>(() => ({
 ...DEFAULTS,
 ...toAgencyServiceDefaults(defaultValue),
 }))
 const hiddenRef = useRef<HTMLInputElement>(null)

 useEffect(() => {
 if (hiddenRef.current) hiddenRef.current.value = JSON.stringify(data)
 }, [data])

 const set = <K extends keyof AgencyServiceExtraData>(key: K, value: AgencyServiceExtraData[K]) =>
 setData(prev => ({ ...prev, [key]: value }))

 const toggleService = (value: string) =>
 setData(prev => ({
 ...prev,
 services: prev.services.includes(value)
 ? prev.services.filter(s => s !== value)
 : [...prev.services, value],
 }))

 return (
 <div className="space-y-4">
 <input ref={hiddenRef} type="hidden" name="contract_type_data_json" defaultValue={JSON.stringify(data)} />

 {/* Услуги */}
 <div className="hp-card p-6 space-y-4">
 <h2 className={sectionTitle}><ListChecks className="w-4 h-4 text-[var(--hp-info)]" /> Оказываемые услуги</h2>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
 {AGENCY_SERVICE_OPTIONS.map(opt => (
 <label key={opt.value}
 className="flex items-center gap-2 p-2.5 border border-border cursor-pointer hover:bg-accent transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5 text-sm">
 <input type="checkbox" className="accent-primary shrink-0"
 checked={data.services.includes(opt.value)}
 onChange={() => toggleService(opt.value)} />
 {opt.label}
 </label>
 ))}
 </div>

 <div>
 <label className={lbl}>Другая услуга (свободный текст, необязательно)</label>
 <input className={inp} placeholder="например, подготовка документов для перепланировки"
 value={data.service_other}
 onChange={e => set('service_other', e.target.value)} />
 </div>
 </div>

 {/* Вознаграждение */}
 <div className="hp-card p-6 space-y-4">
 <h2 className={sectionTitle}><Wallet className="w-4 h-4 text-[var(--hp-good)]" /> Модель вознаграждения</h2>

 <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
 {(Object.keys(REWARD_MODEL_LABELS) as RewardModel[]).map(key => (
 <label key={key}
 className="flex items-center gap-2 p-2.5 border border-border cursor-pointer hover:bg-accent transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5 text-sm">
 <input type="radio" name="reward_model_ui" className="accent-primary shrink-0"
 checked={data.reward_model === key}
 onChange={() => set('reward_model', key)} />
 {REWARD_MODEL_LABELS[key]}
 </label>
 ))}
 </div>

 {(data.reward_model === 'percent' || data.reward_model === 'fixed_percent') && (
 <div className="max-w-xs">
 <label className={lbl + ' flex items-center gap-1.5'}><Percent className="w-3.5 h-3.5" /> Процент от суммы сделки</label>
 <input className={inp} type="number" min={0} max={100} step="0.1" placeholder="5"
 value={data.reward_percent}
 onChange={e => set('reward_percent', e.target.value)} />
 </div>
 )}
 <p className="text-xs text-muted-foreground">
 Сумма вознаграждения указывается в блоке «Финансы и сроки» выше.
 </p>

 <div className="pt-2 border-t border-border">
 <label className={lbl}>Условия оплаты</label>
 <select className={sel} value={data.payment_terms}
 onChange={e => set('payment_terms', e.target.value as PaymentTerms)}>
 {(Object.keys(PAYMENT_TERMS_LABELS) as PaymentTerms[]).map(key => (
 <option key={key} value={key}>{PAYMENT_TERMS_LABELS[key]}</option>
 ))}
 </select>
 </div>
 </div>
 </div>
 )
}
