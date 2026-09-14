'use client'

import { useState } from 'react'
import { ANALYTICS_EVENTS, analyticsAttrs } from '../analytics'
import {
  DEFAULT_DISTRICT,
  DEFAULT_ROOMS,
  DISTRICTS,
  RATE_SLIDER,
  RENT_RATES,
  ROOMS_OPTIONS,
  TARIFFS,
  TARIFF_IDS,
  USLUGI,
  USLUGI_CONTACTS,
  tariffCommissionLabel,
  type District,
  type RoomsKey,
  type TariffId,
} from '../config'
import { calculateIncome, clampRate, formatRub, guaranteeCostPerMonth } from '../calc'
import { requestLead, updateCalcContext } from '../lead-context-store'

interface Props {
  /** id-якорь блока — на него ведут кнопки «Посчитать» и липкая панель */
  id?: string
}

// Строка классов повторяет `inputClass` из UslugiLeadForm.tsx — файл не
// импортируем, чтобы калькулятор не тянул за собой форму.
const inputClass =
  'w-full h-11 px-4 text-[14px] outline-none transition-colors border bg-[var(--hp-surface)] text-[var(--hp-ink)] placeholder:text-[var(--hp-tertiary)] border-[var(--hp-border)] focus:border-[var(--hp-ink)] rounded-[var(--hp-radius)]'

const selectClass = `${inputClass} appearance-none`

/** Строка «Кто ведёт квартиру» из таблицы результата — текст, а не число */
const WHO_MANAGES: Record<TariffId, string> = {
  podbor: 'Вы сами',
  upravlenie: 'Мы',
  premium: 'Мы + гарантия платежа',
}

const SERIF = "'Source Serif 4', Georgia, serif"

/**
 * Калькулятор дохода собственника — блок первого экрана /uslugi/sdat-kvartiru.
 *
 * Возвращает карточку без внешнего контейнера: её кладут рядом с H1.
 * Ставка подставляется из RENT_RATES при смене района/комнатности; ручная
 * правка ползунка или поля фиксируется флагом `rateTouched` и не
 * перезатирается до следующей смены района/комнатности. Все суммы — из
 * `calculateIncome`, собственных процентов здесь нет.
 */
export function IncomeCalculator({ id }: Props) {
  const [district, setDistrict] = useState<District>(DEFAULT_DISTRICT)
  const [rooms, setRooms] = useState<RoomsKey>(DEFAULT_ROOMS)
  const [rate, setRate] = useState<number>(RENT_RATES[DEFAULT_DISTRICT][DEFAULT_ROOMS])
  const [rateInput, setRateInput] = useState<string>(
    String(RENT_RATES[DEFAULT_DISTRICT][DEFAULT_ROOMS])
  )
  // Флаг ручной правки ставки: пока он true, смена района/комнатности —
  // единственное, что может вернуть ставку к ориентиру из таблицы.
  const [rateTouched, setRateTouched] = useState(false)

  // Дефолтные значения в контекст заявки НЕ публикуем: если посетитель не
  // трогал калькулятор, «Советский · 2 · 35 000» в лиде — выдумка, а не его
  // данные. Контекст появляется только после реального взаимодействия
  // (applyPreset / applyManualRate) или по кнопке «Получить расчёт».

  function applyPreset(nextDistrict: District, nextRooms: RoomsKey) {
    const preset = RENT_RATES[nextDistrict][nextRooms]
    setDistrict(nextDistrict)
    setRooms(nextRooms)
    setRate(preset)
    setRateInput(String(preset))
    setRateTouched(false)
    updateCalcContext({ district: nextDistrict, rooms: nextRooms, rate: preset })
  }

  function applyManualRate(next: number) {
    setRate(next)
    setRateInput(String(next))
    setRateTouched(true)
    updateCalcContext({ district, rooms, rate: next })
  }

  function commitRateInput() {
    applyManualRate(clampRate(Number(rateInput), RATE_SLIDER))
  }

  const calc = calculateIncome(rate)
  const guaranteeCost = guaranteeCostPerMonth(rate)

  const districtId = `${id ?? 'calc'}-district`
  const roomsId = `${id ?? 'calc'}-rooms`
  const rateRangeId = `${id ?? 'calc'}-rate-range`
  const rateNumberId = `${id ?? 'calc'}-rate-number`

  return (
    <div
      id={id}
      className="border p-5 sm:p-6 scroll-mt-20"
      style={{
        background: 'var(--hp-surface)',
        borderColor: 'var(--hp-border)',
        borderRadius: 'var(--hp-radius)',
      }}
      {...analyticsAttrs(ANALYTICS_EVENTS.calcInteract)}
      data-hp-rate-manual={rateTouched ? 'true' : undefined}
    >
      <h2 className="text-[20px] sm:text-[22px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
        Посчитайте, сколько останется у вас на руки
      </h2>
      <p className="mt-2 text-[14px] sm:text-[15px] leading-relaxed" style={{ color: 'var(--hp-sub)' }}>
        Три тарифа — от разового подбора до полного управления. Проценты в голове не сравниваются,
        поэтому считаем сразу в рублях.
      </p>

      {/* Поля */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="hp-label" htmlFor={districtId}>Район</label>
          <select
            id={districtId}
            className={selectClass}
            value={district}
            onChange={e => applyPreset(e.target.value as District, rooms)}
          >
            {DISTRICTS.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="hp-label" htmlFor={roomsId}>Комнат</label>
          <select
            id={roomsId}
            className={selectClass}
            value={rooms}
            onChange={e => applyPreset(district, e.target.value as RoomsKey)}
          >
            {ROOMS_OPTIONS.map(o => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 space-y-1.5">
        <label className="hp-label" htmlFor={rateRangeId}>Ставка аренды в месяц</label>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <input
            id={rateRangeId}
            type="range"
            min={RATE_SLIDER.min}
            max={RATE_SLIDER.max}
            step={RATE_SLIDER.step}
            value={rate}
            aria-valuetext={formatRub(rate)}
            onChange={e => applyManualRate(Number(e.target.value))}
            className="w-full h-11 cursor-pointer"
            style={{ accentColor: 'var(--hp-accent)' }}
          />
          <div className="flex items-center gap-2 shrink-0 sm:w-[180px]">
            <label className="sr-only" htmlFor={rateNumberId}>Ставка аренды в месяц, рублей</label>
            <input
              id={rateNumberId}
              type="number"
              inputMode="numeric"
              min={RATE_SLIDER.min}
              max={RATE_SLIDER.max}
              step={RATE_SLIDER.step}
              value={rateInput}
              onChange={e => setRateInput(e.target.value)}
              onBlur={commitRateInput}
              onKeyDown={e => {
                if (e.key === 'Enter') commitRateInput()
              }}
              className={inputClass}
            />
            <span className="text-[14px] shrink-0" style={{ color: 'var(--hp-sub)' }}>₽</span>
          </div>
        </div>
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--hp-sub)' }}>
          Это ориентир по похожим объявлениям. Точную ставку агент называет после осмотра — часто она
          выше той, которую собственник ставит сам.
        </p>
      </div>

      {/* Результат */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {TARIFF_IDS.map(tariffId => {
          const tariff = TARIFFS[tariffId]
          const c = calc[tariffId]
          return (
            <div
              key={tariffId}
              className="hp-block flex flex-col min-w-0"
              style={tariff.popular ? { borderColor: 'var(--hp-accent)' } : undefined}
            >
              <div className="px-4 pt-4 pb-3">
                <p className="text-[15px] font-semibold leading-snug" style={{ color: 'var(--hp-ink)' }}>
                  {tariff.calcName}
                </p>
                <p className="mt-1 text-[12.5px]" style={{ color: 'var(--hp-sub)' }}>
                  Ваша комиссия — {tariffCommissionLabel(tariff)}
                </p>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--hp-sub)' }}>
                  На руки в месяц
                </p>
                <p
                  className="mt-0.5 text-[24px] sm:text-[26px] font-bold tracking-tight leading-tight break-words"
                  style={{ fontFamily: SERIF, color: 'var(--hp-ink)' }}
                >
                  {formatRub(c.monthlyToOwner)}
                </p>
              </div>

              {/* Ряды «лейбл над значением»: три карточки в ряд узкие, в строку не помещаются */}
              <div className="px-4 py-2.5 border-t" style={{ borderColor: 'var(--hp-border-soft)' }}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--hp-sub)' }}>
                  За первый год
                </p>
                <p className="mt-0.5 text-[14px] font-semibold break-words" style={{ color: 'var(--hp-ink)' }}>
                  {formatRub(c.firstYear)}
                </p>
              </div>
              <div className="px-4 py-2.5 border-t" style={{ borderColor: 'var(--hp-border-soft)' }}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--hp-sub)' }}>
                  Дальше
                </p>
                <p className="mt-0.5 text-[14px] font-semibold break-words" style={{ color: 'var(--hp-ink)' }}>
                  {formatRub(c.nextYears)} в год
                </p>
                {tariff.commissionKind === 'once' && (
                  <p className="mt-0.5 text-[12px] leading-snug" style={{ color: 'var(--hp-sub)' }}>
                    при новом заселении — разово {formatRub(c.perNewTenant)}
                  </p>
                )}
              </div>
              <div className="px-4 py-2.5 border-t mt-auto" style={{ borderColor: 'var(--hp-border-soft)' }}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--hp-sub)' }}>
                  Кто ведёт квартиру
                </p>
                <p className="mt-0.5 text-[13.5px] font-medium" style={{ color: 'var(--hp-ink)' }}>
                  {WHO_MANAGES[tariffId]}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      <p className="mt-3 text-[13px] leading-relaxed" style={{ color: 'var(--hp-sub)' }}>
        Первый год посчитан с учётом бесплатной первой сделки. Со второго года комиссия считается по
        тарифу.
      </p>

      <div
        className="mt-3 px-4 py-3 text-[13.5px] leading-relaxed"
        style={{
          background: 'var(--hp-warn-tint)',
          color: 'var(--hp-ink)',
          borderRadius: 'var(--hp-radius)',
        }}
      >
        Гарантия платежа обходится в <strong className="font-semibold">{formatRub(guaranteeCost)}</strong> в
        месяц — разница между «Управлением» и «Премиумом».
      </div>

      {/* Кнопки */}
      <div className="mt-5 flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          className="hp-btn-primary h-11 justify-center"
          onClick={() => requestLead({ intent: 'calculator', district, rooms, rate })}
          {...analyticsAttrs(ANALYTICS_EVENTS.calcLeadClick)}
        >
          Получить расчёт по моему адресу
        </button>
        <a
          href={USLUGI_CONTACTS.telegramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hp-btn-secondary h-11 justify-center"
          {...analyticsAttrs(ANALYTICS_EVENTS.telegramClick)}
        >
          Написать в Telegram
        </a>
      </div>
      <p className="mt-2 text-[12.5px]" style={{ color: 'var(--hp-sub)' }}>
        Перезвоним в течение {USLUGI.callback.withinMinutes} минут. {USLUGI.callback.workingHours}.
      </p>
    </div>
  )
}
