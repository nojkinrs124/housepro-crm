/**
 * Виды приборов учёта. Значения совпадают с CHECK на `utility_meters.kind`:
 * список в базе появился раньше интерфейса, менять его незачем.
 *
 * Файл намеренно без 'use client'.
 */

export const METER_KINDS = [
  { value: 'electricity', label: 'Электричество', unit: 'кВт·ч' },
  { value: 'cold_water',  label: 'Холодная вода', unit: 'м³' },
  { value: 'hot_water',   label: 'Горячая вода',  unit: 'м³' },
  { value: 'gas',         label: 'Газ',           unit: 'м³' },
  { value: 'heating',     label: 'Отопление',     unit: 'Гкал' },
  { value: 'other',       label: 'Другой',        unit: '' },
] as const

export const METER_KIND_LABELS: Record<string, string> =
  Object.fromEntries(METER_KINDS.map(k => [k.value, k.label]))

export const METER_KIND_UNITS: Record<string, string> =
  Object.fromEntries(METER_KINDS.map(k => [k.value, k.unit]))

export function meterLabel(title: string | null, kind: string): string {
  return title || METER_KIND_LABELS[kind] || kind
}
