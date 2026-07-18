'use client'

import { useEffect, useRef, useState } from 'react'
import { Building2, ClipboardList, Wallet } from 'lucide-react'
import {
  type CommercialRentExtraData,
  COMMERCIAL_RENT_EXTRA_DEFAULTS,
  toCommercialRentDefaults,
  type RenovationBy,
} from '../utils/commercial-rent-data'
import type { InventoryItem } from '../utils/rent-apartment-data'

export type { CommercialRentExtraData }

const DEFAULTS = COMMERCIAL_RENT_EXTRA_DEFAULTS

interface Props {
  defaultValue?: unknown
}

const inp = 'w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all'
const sel = inp + ' cursor-pointer'
const lbl = 'block text-sm font-medium text-foreground mb-1.5'
const sectionTitle = 'font-semibold text-foreground flex items-center gap-2'
const smallBtn = 'text-xs font-medium text-primary hover:underline'
const removeBtn = 'text-xs font-medium text-destructive hover:underline'

export function CommercialRentExtraFields({ defaultValue }: Props) {
  const [data, setData] = useState<CommercialRentExtraData>(() => ({
    ...DEFAULTS,
    ...toCommercialRentDefaults(defaultValue),
  }))
  const hiddenRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (hiddenRef.current) hiddenRef.current.value = JSON.stringify(data)
  }, [data])

  const set = <K extends keyof CommercialRentExtraData>(key: K, value: CommercialRentExtraData[K]) =>
    setData(prev => ({ ...prev, [key]: value }))

  const addItem = () =>
    set('inventory_items', [...data.inventory_items, { name: '', qty: '1', unit_price: '', condition: 'хорошее' }])
  const removeItem = (i: number) => set('inventory_items', data.inventory_items.filter((_, idx) => idx !== i))
  const updateItem = (i: number, patch: Partial<InventoryItem>) =>
    set('inventory_items', data.inventory_items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))

  return (
    <div className="space-y-4">
      <input ref={hiddenRef} type="hidden" name="contract_type_data_json" defaultValue={JSON.stringify(data)} />

      <div className="bg-card border border-border rounded-[20px] p-6 space-y-4">
        <h2 className={sectionTitle}><Building2 className="w-4 h-4 text-blue-500" /> Условия использования</h2>

        <div>
          <label className={lbl}>Назначение использования помещения</label>
          <input className={inp} placeholder="например, розничная торговля, офис, склад"
            value={data.usage_purpose}
            onChange={e => set('usage_purpose', e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Ремонт / отделку выполняет</label>
            <select className={sel} value={data.renovation_by}
              onChange={e => set('renovation_by', e.target.value as RenovationBy)}>
              <option value="tenant">Арендатор</option>
              <option value="landlord">Арендодатель</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Количество экземпляров договора</label>
            <input className={inp} type="number" min={1} value={data.copies_count}
              onChange={e => set('copies_count', e.target.value)} />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium pt-1">
          <input type="checkbox" checked={data.vat_included}
            onChange={e => set('vat_included', e.target.checked)} className="accent-primary" />
          НДС включён в стоимость аренды
        </label>
      </div>

      <div className="bg-card border border-border rounded-[20px] p-6 space-y-4">
        <h2 className={sectionTitle}><Wallet className="w-4 h-4 text-rose-500" /> Неустойка</h2>
        <div className="max-w-xs">
          <label className={lbl}>Неустойка за просрочку возврата (₽/день)</label>
          <input className={inp} type="number" min={0} value={data.late_return_penalty_per_day}
            onChange={e => set('late_return_penalty_per_day', e.target.value)} />
        </div>
      </div>

      <div className="bg-card border border-border rounded-[20px] p-6 space-y-4">
        <h2 className={sectionTitle}><ClipboardList className="w-4 h-4 text-orange-500" /> Опись оборудования / имущества</h2>
        <div className="space-y-2">
          {data.inventory_items.map((it, i) => (
            <div key={i} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 items-center">
              <input className={inp} placeholder="Наименование" value={it.name}
                onChange={e => updateItem(i, { name: e.target.value })} />
              <input className={inp} placeholder="Кол-во" value={it.qty}
                onChange={e => updateItem(i, { qty: e.target.value })} />
              <input className={inp} placeholder="Цена, ₽" value={it.unit_price}
                onChange={e => updateItem(i, { unit_price: e.target.value })} />
              <input className={inp} placeholder="Состояние" value={it.condition}
                onChange={e => updateItem(i, { condition: e.target.value })} />
              <button type="button" className={removeBtn} onClick={() => removeItem(i)}>Удалить</button>
            </div>
          ))}
          <button type="button" className={smallBtn} onClick={addItem}>+ Добавить позицию</button>
        </div>
      </div>
    </div>
  )
}
