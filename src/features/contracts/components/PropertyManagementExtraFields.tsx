'use client'

import { useEffect, useRef, useState } from 'react'
import { ListChecks, CalendarClock } from 'lucide-react'
import {
 type PropertyManagementExtraData,
 PROPERTY_MANAGEMENT_EXTRA_DEFAULTS,
 PROPERTY_MANAGEMENT_SERVICE_OPTIONS,
 REPORT_FREQUENCY_LABELS,
 toPropertyManagementDefaults,
 type ReportFrequency,
} from '../utils/property-management-data'

export type { PropertyManagementExtraData }

const DEFAULTS = PROPERTY_MANAGEMENT_EXTRA_DEFAULTS

interface Props {
 defaultValue?: unknown
}

const inp = 'w-full h-10 px-4 border border-input bg-background text-sm outline-none focus:border-[var(--hp-ink)] transition-all'
const sel = inp + ' cursor-pointer'
const lbl = 'block text-sm font-medium text-foreground mb-1.5'
const sectionTitle = 'font-semibold text-foreground flex items-center gap-2'

export function PropertyManagementExtraFields({ defaultValue }: Props) {
 const [data, setData] = useState<PropertyManagementExtraData>(() => ({
 ...DEFAULTS,
 ...toPropertyManagementDefaults(defaultValue),
 }))
 const hiddenRef = useRef<HTMLInputElement>(null)

 useEffect(() => {
 if (hiddenRef.current) hiddenRef.current.value = JSON.stringify(data)
 }, [data])

 const set = <K extends keyof PropertyManagementExtraData>(key: K, value: PropertyManagementExtraData[K]) =>
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

 <div className="hp-card p-6 space-y-4">
 <h2 className={sectionTitle}><ListChecks className="w-4 h-4 text-[var(--hp-info)]" /> Услуги по управлению</h2>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
 {PROPERTY_MANAGEMENT_SERVICE_OPTIONS.map(opt => (
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
 <input className={inp} value={data.service_other}
 onChange={e => set('service_other', e.target.value)} />
 </div>
 </div>

 <div className="hp-card p-6 space-y-4">
 <h2 className={sectionTitle}><CalendarClock className="w-4 h-4 text-[var(--hp-sub)]" /> Отчётность и вознаграждение</h2>
 <div>
 <label className={lbl}>Периодичность отчёта перед собственником</label>
 <select className={sel} value={data.report_frequency}
 onChange={e => set('report_frequency', e.target.value as ReportFrequency)}>
 {(Object.keys(REPORT_FREQUENCY_LABELS) as ReportFrequency[]).map(key => (
 <option key={key} value={key}>{REPORT_FREQUENCY_LABELS[key]}</option>
 ))}
 </select>
 </div>
 <div>
 <label className={lbl}>Что входит в вознаграждение / особые условия (необязательно)</label>
 <textarea className="w-full px-4 py-2.5 border border-input bg-background text-sm outline-none focus:border-[var(--hp-ink)] transition-all resize-none"
 rows={2} value={data.reward_details}
 onChange={e => set('reward_details', e.target.value)} />
 </div>
 </div>
 </div>
 )
}
