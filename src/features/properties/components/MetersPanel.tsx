'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Gauge, Plus, X } from 'lucide-react'
import { addMeterReadingAction, createMeterAction, deactivateMeterAction } from '../actions/meters.actions'
import { METER_KIND_LABELS, METER_KIND_UNITS } from '@/features/meters/config/meter-kinds'

export interface MeterReadingRow {
 id: string
 reading_date: string
 value: number
 consumption: number | null
 amount: number | null
 /** Кто внёс: менеджер снял сам или арендатор прислал из кабинета. */
 source?: string | null
}

export interface MeterRow {
 id: string
 kind: string
 title: string | null
 serial_number: string | null
 unit: string
 tariff: number | null
 readings: MeterReadingRow[]
}

// Словари видов приборов — из общего справочника. Своя копия здесь разошлась бы
// с проверкой на сервере и с сообщениями при закрытии акта приёма.
const KIND_LABELS = METER_KIND_LABELS
const DEFAULT_UNITS = METER_KIND_UNITS

function fmtDate(iso: string): string {
 return new Date(`${iso}T00:00:00Z`).toLocaleDateString('ru-RU', { timeZone: 'UTC' })
}

/**
 * Счётчики объекта и показания.
 *
 * До этого коммуналка по счётчикам жила в переписке и таблицах: каждый месяц
 * агент спрашивал показания, считал разницу и сумму в калькуляторе. Здесь
 * расход и сумма считаются при вводе и сохраняются вместе с показанием.
 */
export function MetersPanel({ propertyId, meters }: { propertyId: string; meters: MeterRow[] }) {
 const [addingMeter, setAddingMeter] = useState(false)
 const [kind, setKind] = useState('electricity')
 const [readingFor, setReadingFor] = useState<string | null>(null)
 const [isPending, startTransition] = useTransition()

 function submitMeter(formData: FormData) {
 startTransition(async () => {
 const res = await createMeterAction(propertyId, formData)
 if (res.error) { toast.error(res.error); return }
 toast.success('Счётчик добавлен')
 setAddingMeter(false)
 })
 }

 function submitReading(meterId: string, formData: FormData) {
 startTransition(async () => {
 const res = await addMeterReadingAction(meterId, propertyId, formData)
 if (res.error) { toast.error(res.error); return }
 toast.success(res.message ?? 'Показание сохранено')
 // Аномалии показываются отдельными предупреждениями: пропущенный месяц
 // уже не восстановить, а скачок расхода может быть утечкой.
 for (const w of res.warnings ?? []) toast.warning(w)
 setReadingFor(null)
 })
 }

 function removeMeter(meterId: string) {
 if (!confirm('Снять счётчик с учёта? Показания останутся в истории объекта.')) return
 startTransition(async () => {
 const res = await deactivateMeterAction(meterId, propertyId)
 if (res.error) { toast.error(res.error); return }
 toast.success('Счётчик снят с учёта')
 })
 }

 return (
 <div className="hp-card p-5 space-y-4">
 <div className="flex items-center justify-between gap-3 flex-wrap">
 <div className="flex items-center gap-2">
 <Gauge className="w-4 h-4 text-[var(--hp-sub)]" />
 <h2 className="font-bold text-[var(--hp-ink)] text-[15px]">Счётчики</h2>
 </div>
 {!addingMeter && (
 <button
 type="button"
 onClick={() => setAddingMeter(true)}
 className="flex items-center gap-1.5 text-sm font-medium text-[var(--hp-sub)] hover:text-[var(--hp-ink)] transition-colors"
 >
 <Plus className="w-4 h-4" />
 Добавить счётчик
 </button>
 )}
 </div>

 {addingMeter && (
 <form action={submitMeter} className="border border-[var(--hp-border)] p-4 space-y-3">
 <div className="flex items-center justify-between">
 <span className="text-sm font-semibold text-[var(--hp-ink)]">Новый счётчик</span>
 <button type="button" onClick={() => setAddingMeter(false)} className="text-[var(--hp-sub)]">
 <X className="w-4 h-4" />
 </button>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div className="space-y-1.5">
 <label className="hp-label" htmlFor="m-kind">Тип</label>
 <select
 id="m-kind"
 name="kind"
 value={kind}
 onChange={(e) => setKind(e.target.value)}
 className="w-full h-10 px-4 rounded-[var(--hp-radius)] border border-[var(--hp-border)] bg-[var(--hp-surface)] text-[var(--hp-ink)] text-sm outline-none focus:border-[var(--hp-ink)] cursor-pointer transition-colors"
 >
 {Object.entries(KIND_LABELS).map(([value, label]) => (
 <option key={value} value={value}>{label}</option>
 ))}
 </select>
 </div>
 <div className="space-y-1.5">
 <label className="hp-label" htmlFor="m-serial">Номер прибора</label>
 <input id="m-serial" name="serial_number" placeholder="№ 1234567" className="hp-input" />
 </div>
 <div className="space-y-1.5">
 <label className="hp-label" htmlFor="m-unit">Единица</label>
 <input
 id="m-unit"
 name="unit"
 key={kind}
 defaultValue={DEFAULT_UNITS[kind] ?? 'ед.'}
 className="hp-input"
 />
 </div>
 <div className="space-y-1.5">
 <label className="hp-label" htmlFor="m-tariff">Тариф за единицу, ₽</label>
 <input id="m-tariff" name="tariff" inputMode="decimal" placeholder="3,48" className="hp-input" />
 </div>
 </div>

 <button
 type="submit"
 disabled={isPending}
 className="px-5 py-2.5 text-white rounded-[var(--hp-radius)] text-sm font-semibold transition-colors bg-[var(--hp-accent)] hover:bg-[var(--hp-accent-hover)] disabled:opacity-60"
 >
 {isPending ? 'Сохраняем…' : 'Добавить'}
 </button>
 </form>
 )}

 {meters.length === 0 && !addingMeter ? (
 <p className="text-sm text-[var(--hp-sub)]">
 Счётчиков нет. Добавьте их, чтобы вести показания и считать коммуналку по расходу.
 </p>
 ) : (
 <div className="space-y-3">
 {meters.map((meter) => {
 const last = meter.readings[0]
 return (
 <div key={meter.id} className="border border-[var(--hp-border)] p-4 space-y-3">
 <div className="flex items-start justify-between gap-3 flex-wrap">
 <div className="min-w-0">
 <p className="text-sm font-semibold text-[var(--hp-ink)]">
 {meter.title || KIND_LABELS[meter.kind] || 'Счётчик'}
 {meter.serial_number && (
 <span className="text-[var(--hp-sub)] font-normal"> · № {meter.serial_number}</span>
 )}
 </p>
 <p className="text-xs text-[var(--hp-sub)] mt-0.5">
 {last
 ? `Последнее: ${last.value} ${meter.unit} от ${fmtDate(last.reading_date)}`
 : 'Показаний ещё нет'}
 {meter.tariff ? ` · тариф ${meter.tariff} ₽/${meter.unit}` : ''}
 </p>
 </div>
 <div className="flex items-center gap-2 shrink-0">
 <button
 type="button"
 onClick={() => setReadingFor(readingFor === meter.id ? null : meter.id)}
 className="px-3 py-1.5 border border-[var(--hp-border)] rounded-[var(--hp-radius)] text-xs font-medium text-[var(--hp-ink)] hover:border-[var(--hp-sub)] transition-colors"
 >
 Внести показание
 </button>
 <button
 type="button"
 onClick={() => removeMeter(meter.id)}
 className="p-1.5 text-[var(--hp-sub)] hover:text-[var(--hp-danger)] transition-colors"
 aria-label="Снять с учёта"
 >
 <X className="w-4 h-4" />
 </button>
 </div>
 </div>

 {readingFor === meter.id && (
 <form
 action={(formData) => submitReading(meter.id, formData)}
 className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end"
 >
 <div className="space-y-1.5">
 <label className="hp-label" htmlFor={`r-value-${meter.id}`}>
 Показание, {meter.unit}
 </label>
 <input
 id={`r-value-${meter.id}`}
 name="value"
 inputMode="decimal"
 required
 className="hp-input"
 />
 </div>
 <div className="space-y-1.5">
 <label className="hp-label" htmlFor={`r-date-${meter.id}`}>Дата</label>
 <input
 id={`r-date-${meter.id}`}
 type="date"
 name="reading_date"
 defaultValue={new Date().toISOString().slice(0, 10)}
 className="w-full min-w-0 h-10 px-4 rounded-[var(--hp-radius)] border border-[var(--hp-border)] bg-[var(--hp-surface)] text-[var(--hp-ink)] text-sm outline-none focus:border-[var(--hp-ink)] transition-colors"
 />
 </div>
 <button
 type="submit"
 disabled={isPending}
 className="h-10 px-5 text-white rounded-[var(--hp-radius)] text-sm font-semibold transition-colors bg-[var(--hp-accent)] hover:bg-[var(--hp-accent-hover)] disabled:opacity-60"
 >
 {isPending ? 'Сохраняем…' : 'Сохранить'}
 </button>
 </form>
 )}

 {meter.readings.length > 0 && (
 <div className="hp-block">
 {meter.readings.slice(0, 4).map((reading) => (
 <div key={reading.id} className="hp-block-row">
 <span className="label">{fmtDate(reading.reading_date)}</span>
 <span className="value">
 {reading.value} {meter.unit}
 {reading.consumption !== null && (
 <span className="text-[var(--hp-sub)] font-normal">
 {' '}· расход {reading.consumption}
 {reading.amount !== null ? ` · ${reading.amount.toLocaleString('ru-RU')} ₽` : ''}
 </span>
 )}
 </span>
 </div>
 ))}
 </div>
 )}
 </div>
 )
 })}
 </div>
 )}
 </div>
 )
}
