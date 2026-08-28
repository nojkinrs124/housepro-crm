'use client'

import { useEffect, useRef, useState } from 'react'
import { Banknote, Key, ShieldAlert } from 'lucide-react'
import {
 type SaleExtraData,
 SALE_EXTRA_DEFAULTS,
 PAYMENT_METHOD_LABELS,
 REGISTRATION_EXPENSES_PAYER_LABELS,
 toSaleDefaults,
 type PaymentMethod,
 type RegistrationExpensesPayer,
} from '../utils/sale-data'

export type { SaleExtraData }

const DEFAULTS = SALE_EXTRA_DEFAULTS

interface Props {
 defaultValue?: unknown
}

const inp = 'w-full h-10 px-4 border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all'
const sel = inp + ' cursor-pointer'
const lbl = 'block text-sm font-medium text-foreground mb-1.5'
const sectionTitle = 'font-semibold text-foreground flex items-center gap-2'

export function SaleExtraFields({ defaultValue }: Props) {
 const [data, setData] = useState<SaleExtraData>(() => ({
 ...DEFAULTS,
 ...toSaleDefaults(defaultValue),
 }))
 const hiddenRef = useRef<HTMLInputElement>(null)

 useEffect(() => {
 if (hiddenRef.current) hiddenRef.current.value = JSON.stringify(data)
 }, [data])

 const set = <K extends keyof SaleExtraData>(key: K, value: SaleExtraData[K]) =>
 setData(prev => ({ ...prev, [key]: value }))

 return (
 <div className="space-y-4">
 <input ref={hiddenRef} type="hidden" name="contract_type_data_json" defaultValue={JSON.stringify(data)} />

 <div className="bg-card border border-border p-6 space-y-4">
 <h2 className={sectionTitle}><Banknote className="w-4 h-4 text-emerald-500" /> Расчёты</h2>

 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className={lbl}>Способ оплаты</label>
 <select className={sel} value={data.payment_method}
 onChange={e => set('payment_method', e.target.value as PaymentMethod)}>
 {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map(key => (
 <option key={key} value={key}>{PAYMENT_METHOD_LABELS[key]}</option>
 ))}
 </select>
 </div>
 <div>
 <label className={lbl}>Задаток / аванс до подписания (₽)</label>
 <input className={inp} type="number" min={0} placeholder="0"
 value={data.advance_amount}
 onChange={e => set('advance_amount', e.target.value)} />
 </div>
 </div>

 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className={lbl}>Расходы на регистрацию перехода права несёт</label>
 <select className={sel} value={data.registration_expenses_payer}
 onChange={e => set('registration_expenses_payer', e.target.value as RegistrationExpensesPayer)}>
 {(Object.keys(REGISTRATION_EXPENSES_PAYER_LABELS) as RegistrationExpensesPayer[]).map(key => (
 <option key={key} value={key}>{REGISTRATION_EXPENSES_PAYER_LABELS[key]}</option>
 ))}
 </select>
 </div>
 <div>
 <label className={lbl}>Количество экземпляров договора</label>
 <input className={inp} type="number" min={1} value={data.copies_count}
 onChange={e => set('copies_count', e.target.value)} />
 </div>
 </div>
 </div>

 <div className="bg-card border border-border p-6 space-y-4">
 <h2 className={sectionTitle}><ShieldAlert className="w-4 h-4 text-amber-500" /> Обременения и зарегистрированные лица</h2>
 <div>
 <label className={lbl}>Обременения (залог, аренда, арест и т.д.)</label>
 <input className={inp} value={data.encumbrances}
 onChange={e => set('encumbrances', e.target.value)} />
 </div>
 <div>
 <label className={lbl}>Лица, сохраняющие право пользования / зарегистрированные в объекте</label>
 <input className={inp} value={data.registered_persons}
 onChange={e => set('registered_persons', e.target.value)} />
 </div>
 </div>

 <div className="bg-card border border-border p-6 space-y-4">
 <h2 className={sectionTitle}><Key className="w-4 h-4 text-orange-500" /> Передача объекта</h2>
 <div>
 <label className={lbl}>Порядок и срок передачи ключей / объекта</label>
 <textarea className="w-full px-4 py-2.5 border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none"
 rows={2} value={data.key_transfer_order}
 onChange={e => set('key_transfer_order', e.target.value)} />
 </div>
 </div>
 </div>
 )
}
