'use client'

import { useEffect, useRef, useState } from 'react'
import { PawPrint, Users, Bell, Wallet, Key, ClipboardList, DoorOpen } from 'lucide-react'

export interface Cohabitant {
  full_name: string
  passport: string
}

export interface InventoryItem {
  name: string
  qty: string
  unit_price: string
  condition: string
}

export interface RentApartmentExtraData {
  cohabitants: Cohabitant[]
  children_count: string
  pets_allowed: boolean
  pets_species: string
  pets_count: string
  renewal_notice_months: string
  termination_notice_days: string
  late_return_penalty_per_day: string
  landlord_access_notice_days: string
  utilities_included_in_rent: boolean
  utilities_paid_by_tenant: string
  concierge_internet_payer: 'tenant' | 'landlord'
  copies_count: string
  handover_date: string
  handover_keys_count: string
  electricity_meter_reading: string
  hot_water_meter_reading: string
  cold_water_meter_reading: string
  inventory_items: InventoryItem[]
  return_date: string
  return_keys_count: string
  return_claims: string
}

const DEFAULTS: RentApartmentExtraData = {
  cohabitants: [],
  children_count: '',
  pets_allowed: false,
  pets_species: '',
  pets_count: '',
  renewal_notice_months: '1',
  termination_notice_days: '30',
  late_return_penalty_per_day: '1000',
  landlord_access_notice_days: '1',
  utilities_included_in_rent: false,
  utilities_paid_by_tenant: 'электроэнергия, холодная и горячая вода',
  concierge_internet_payer: 'tenant',
  copies_count: '2',
  handover_date: '',
  handover_keys_count: '2',
  electricity_meter_reading: '',
  hot_water_meter_reading: '',
  cold_water_meter_reading: '',
  inventory_items: [],
  return_date: '',
  return_keys_count: '',
  return_claims: '',
}

interface Props {
  defaultValue?: Partial<RentApartmentExtraData>
}

// Приводит contract_type_data из БД (числа/bool/null) к строковым значениям для контролируемых полей формы.
export function toExtraFieldsDefaults(raw: unknown): Partial<RentApartmentExtraData> {
  if (!raw || typeof raw !== 'object') return {}
  const r = raw as Record<string, unknown>
  const str = (v: unknown) => (v === null || v === undefined ? '' : String(v))

  return {
    cohabitants: Array.isArray(r.cohabitants)
      ? (r.cohabitants as Array<Record<string, unknown>>).map(c => ({
          full_name: str(c.full_name), passport: str(c.passport),
        }))
      : [],
    children_count: str(r.children_count),
    pets_allowed: Boolean(r.pets_allowed),
    pets_species: str(r.pets_species),
    pets_count: str(r.pets_count),
    renewal_notice_months: r.renewal_notice_months != null ? str(r.renewal_notice_months) : undefined,
    termination_notice_days: r.termination_notice_days != null ? str(r.termination_notice_days) : undefined,
    late_return_penalty_per_day: r.late_return_penalty_per_day != null ? str(r.late_return_penalty_per_day) : undefined,
    landlord_access_notice_days: r.landlord_access_notice_days != null ? str(r.landlord_access_notice_days) : undefined,
    utilities_included_in_rent: Boolean(r.utilities_included_in_rent),
    utilities_paid_by_tenant: r.utilities_paid_by_tenant != null ? str(r.utilities_paid_by_tenant) : undefined,
    concierge_internet_payer: (r.concierge_internet_payer as 'tenant' | 'landlord') ?? undefined,
    copies_count: r.copies_count != null ? str(r.copies_count) : undefined,
    handover_date: str(r.handover_date).slice(0, 10),
    handover_keys_count: r.handover_keys_count != null ? str(r.handover_keys_count) : undefined,
    electricity_meter_reading: str(r.electricity_meter_reading),
    hot_water_meter_reading: str(r.hot_water_meter_reading),
    cold_water_meter_reading: str(r.cold_water_meter_reading),
    inventory_items: Array.isArray(r.inventory_items)
      ? (r.inventory_items as Array<Record<string, unknown>>).map(it => ({
          name: str(it.name), qty: str(it.qty), unit_price: str(it.unit_price), condition: str(it.condition),
        }))
      : [],
    return_date: str(r.return_date).slice(0, 10),
    return_keys_count: r.return_keys_count != null ? str(r.return_keys_count) : undefined,
    return_claims: str(r.return_claims),
  }
}

const inp = 'w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all'
const lbl = 'block text-sm font-medium text-foreground mb-1.5'
const sectionTitle = 'font-semibold text-foreground flex items-center gap-2'
const smallBtn = 'text-xs font-medium text-primary hover:underline'
const removeBtn = 'text-xs font-medium text-destructive hover:underline'

export function RentApartmentExtraFields({ defaultValue }: Props) {
  const [data, setData] = useState<RentApartmentExtraData>({ ...DEFAULTS, ...defaultValue })
  const hiddenRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (hiddenRef.current) {
      hiddenRef.current.value = JSON.stringify(data)
    }
  }, [data])

  const set = <K extends keyof RentApartmentExtraData>(key: K, value: RentApartmentExtraData[K]) =>
    setData(prev => ({ ...prev, [key]: value }))

  const addCohabitant = () => set('cohabitants', [...data.cohabitants, { full_name: '', passport: '' }])
  const removeCohabitant = (i: number) => set('cohabitants', data.cohabitants.filter((_, idx) => idx !== i))
  const updateCohabitant = (i: number, patch: Partial<Cohabitant>) =>
    set('cohabitants', data.cohabitants.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))

  const addInventoryItem = () =>
    set('inventory_items', [...data.inventory_items, { name: '', qty: '1', unit_price: '', condition: 'хорошее' }])
  const removeInventoryItem = (i: number) => set('inventory_items', data.inventory_items.filter((_, idx) => idx !== i))
  const updateInventoryItem = (i: number, patch: Partial<InventoryItem>) =>
    set('inventory_items', data.inventory_items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))

  return (
    <div className="space-y-4">
      <input ref={hiddenRef} type="hidden" name="contract_type_data_json" defaultValue={JSON.stringify(data)} />

      {/* Проживающие и животные */}
      <div className="bg-card border border-border rounded-[20px] p-6 space-y-4">
        <h2 className={sectionTitle}><Users className="w-4 h-4 text-blue-500" /> Проживающие и животные</h2>

        <div className="space-y-2">
          <label className={lbl}>Лица, совместно проживающие с нанимателем</label>
          {data.cohabitants.map((c, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input className={inp} placeholder="ФИО" value={c.full_name}
                onChange={e => updateCohabitant(i, { full_name: e.target.value })} />
              <input className={inp} placeholder="Паспорт (серия и номер)" value={c.passport}
                onChange={e => updateCohabitant(i, { passport: e.target.value })} />
              <button type="button" className={removeBtn} onClick={() => removeCohabitant(i)}>Удалить</button>
            </div>
          ))}
          <button type="button" className={smallBtn} onClick={addCohabitant}>+ Добавить проживающего</button>
        </div>

        <div>
          <label className={lbl}>Количество детей</label>
          <input className={inp} type="number" min={0} value={data.children_count}
            onChange={e => set('children_count', e.target.value)} />
        </div>

        <div className="space-y-2 pt-2 border-t border-border">
          <label className="flex items-center gap-2 text-sm font-medium">
            <PawPrint className="w-4 h-4 text-amber-500" />
            <input type="checkbox" checked={data.pets_allowed}
              onChange={e => set('pets_allowed', e.target.checked)} className="accent-primary" />
            Разрешено содержание животных
          </label>
          {data.pets_allowed && (
            <div className="grid grid-cols-2 gap-3 pl-6">
              <div>
                <label className={lbl}>Вид животных</label>
                <input className={inp} placeholder="например, кошка" value={data.pets_species}
                  onChange={e => set('pets_species', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Количество</label>
                <input className={inp} type="number" min={0} value={data.pets_count}
                  onChange={e => set('pets_count', e.target.value)} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Сроки уведомлений и неустойка */}
      <div className="bg-card border border-border rounded-[20px] p-6 space-y-4">
        <h2 className={sectionTitle}><Bell className="w-4 h-4 text-violet-500" /> Уведомления и неустойка</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Срок уведомления о непродлении (мес.)</label>
            <input className={inp} type="number" min={0} value={data.renewal_notice_months}
              onChange={e => set('renewal_notice_months', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Срок уведомления о досрочном расторжении (дней)</label>
            <input className={inp} type="number" min={0} value={data.termination_notice_days}
              onChange={e => set('termination_notice_days', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Неустойка за просрочку возврата (₽/день)</label>
            <input className={inp} type="number" min={0} value={data.late_return_penalty_per_day}
              onChange={e => set('late_return_penalty_per_day', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Срок уведомления о визите для проверки (дней)</label>
            <input className={inp} type="number" min={0} value={data.landlord_access_notice_days}
              onChange={e => set('landlord_access_notice_days', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Коммунальные и экземпляры */}
      <div className="bg-card border border-border rounded-[20px] p-6 space-y-4">
        <h2 className={sectionTitle}><Wallet className="w-4 h-4 text-emerald-500" /> Коммунальные платежи</h2>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={data.utilities_included_in_rent}
            onChange={e => set('utilities_included_in_rent', e.target.checked)} className="accent-primary" />
          Коммунальные услуги включены в арендную плату
        </label>
        <div>
          <label className={lbl}>Перечень услуг, оплачиваемых арендатором отдельно</label>
          <input className={inp} value={data.utilities_paid_by_tenant}
            onChange={e => set('utilities_paid_by_tenant', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Интернет / консьерж оплачивает</label>
            <select className={inp} value={data.concierge_internet_payer}
              onChange={e => set('concierge_internet_payer', e.target.value as 'tenant' | 'landlord')}>
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
      </div>

      {/* Акт приёма-передачи */}
      <div className="bg-card border border-border rounded-[20px] p-6 space-y-4">
        <h2 className={sectionTitle}><Key className="w-4 h-4 text-orange-500" /> Акт приёма-передачи (при заселении)</h2>
        <p className="text-xs text-muted-foreground -mt-2">Можно заполнить сразу или позже, перед фактическим заселением.</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Дата передачи ключей</label>
            <input className={inp} type="date" value={data.handover_date}
              onChange={e => set('handover_date', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Количество комплектов ключей</label>
            <input className={inp} type="number" min={0} value={data.handover_keys_count}
              onChange={e => set('handover_keys_count', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Показания электросчётчика</label>
            <input className={inp} value={data.electricity_meter_reading}
              onChange={e => set('electricity_meter_reading', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Показания счётчика ГВС</label>
            <input className={inp} value={data.hot_water_meter_reading}
              onChange={e => set('hot_water_meter_reading', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Показания счётчика ХВС</label>
            <input className={inp} value={data.cold_water_meter_reading}
              onChange={e => set('cold_water_meter_reading', e.target.value)} />
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t border-border">
          <label className={lbl + ' flex items-center gap-2'}><ClipboardList className="w-4 h-4" /> Опись имущества</label>
          {data.inventory_items.map((it, i) => (
            <div key={i} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 items-center">
              <input className={inp} placeholder="Наименование" value={it.name}
                onChange={e => updateInventoryItem(i, { name: e.target.value })} />
              <input className={inp} placeholder="Кол-во" value={it.qty}
                onChange={e => updateInventoryItem(i, { qty: e.target.value })} />
              <input className={inp} placeholder="Цена, ₽" value={it.unit_price}
                onChange={e => updateInventoryItem(i, { unit_price: e.target.value })} />
              <input className={inp} placeholder="Состояние" value={it.condition}
                onChange={e => updateInventoryItem(i, { condition: e.target.value })} />
              <button type="button" className={removeBtn} onClick={() => removeInventoryItem(i)}>Удалить</button>
            </div>
          ))}
          <button type="button" className={smallBtn} onClick={addInventoryItem}>+ Добавить предмет</button>
        </div>
      </div>

      {/* Акт возврата */}
      <div className="bg-card border border-border rounded-[20px] p-6 space-y-4">
        <h2 className={sectionTitle}><DoorOpen className="w-4 h-4 text-rose-500" /> Акт возврата (при выезде)</h2>
        <p className="text-xs text-muted-foreground -mt-2">Заполняется в момент окончания найма — можно оставить пустым сейчас.</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Дата возврата ключей</label>
            <input className={inp} type="date" value={data.return_date}
              onChange={e => set('return_date', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Количество возвращённых комплектов</label>
            <input className={inp} type="number" min={0} value={data.return_keys_count}
              onChange={e => set('return_keys_count', e.target.value)} />
          </div>
        </div>
        <div>
          <label className={lbl}>Претензии арендодателя к состоянию помещения</label>
          <textarea className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none"
            rows={2} value={data.return_claims}
            onChange={e => set('return_claims', e.target.value)} />
        </div>
      </div>
    </div>
  )
}
