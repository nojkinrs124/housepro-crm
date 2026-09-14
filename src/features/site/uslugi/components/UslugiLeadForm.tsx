'use client'

import { useEffect, useState } from 'react'
import { Loader2, Check, X } from 'lucide-react'
import { ANALYTICS_EVENTS, analyticsAttrs } from '../analytics'
import {
  DISTRICTS,
  ROOMS_OPTIONS,
  USLUGI,
  USLUGI_ANCHORS,
  USLUGI_CONTACTS,
  type UslugiLeadSource,
} from '../config'
import { isDistrict, isRoomsKey, summarizeLeadContext, type UslugiLeadContext } from '../lead-context'
import { resetLeadContext, useLeadContext } from '../lead-context-store'

interface Props {
  /** Источник лида в CRM — свой у каждой страницы раздела */
  source: UslugiLeadSource
  /** Путь страницы для metadata (`/uslugi/sdat-kvartiru`) */
  page: string
  submitLabel: string
  /**
   * Поля «Район» и «Комнат» — только на странице собственника. Подставляются
   * из контекста калькулятора/тарифа и уходят в лид.
   */
  withObjectFields?: boolean
  messagePlaceholder?: string
  /** Подпись под кнопкой */
  footnote?: string
}

const inputClass =
  'w-full h-11 px-4 text-[14px] outline-none transition-colors border bg-[var(--hp-surface)] text-[var(--hp-ink)] placeholder:text-[var(--hp-tertiary)] border-[var(--hp-border)] focus:border-[var(--hp-ink)] rounded-[var(--hp-radius)]'

const selectClass = `${inputClass} appearance-none`

/**
 * Форма заявки страниц раздела «Услуги».
 *
 * Пишет в тот же /api/public/leads, что и LeadForm на главной (service-role,
 * honeypot, rate limit по IP, уведомление в Telegram) — второго пути создания
 * лида нет. Отличия: источник по странице, контекст (тариф, район, комнаты,
 * ставка) из lead-context-store и экран успеха с номером, с которого перезвонят.
 */
export function UslugiLeadForm({
  source,
  page,
  submitLabel,
  withObjectFields = false,
  messagePlaceholder = 'Например: двушка в Советском районе, сейчас сдаю сама, устала от звонков',
  footnote = `Перезвоним в течение ${USLUGI.callback.withinMinutes} минут. ${USLUGI.callback.workingHours}. Контакты используем только для ответа.`,
}: Props) {
  const context = useLeadContext()
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)

  // Район/комнаты — controlled, чтобы кнопка тарифа или калькулятор могли их
  // подставить уже после того, как пользователь открыл страницу.
  const [district, setDistrict] = useState<string>('')
  const [rooms, setRooms] = useState<string>('')
  useEffect(() => {
    if (context.district) setDistrict(context.district)
    if (context.rooms) setRooms(context.rooms)
  }, [context.district, context.rooms])

  const summary = summarizeLeadContext(context)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setStatus('sending')

    const form = e.currentTarget
    const data = new FormData(form)

    const ctx: UslugiLeadContext = { ...context }
    if (withObjectFields) {
      // Поля формы главнее контекста: пользователь мог поправить руками.
      const d = String(data.get('district') ?? '')
      const r = String(data.get('rooms') ?? '')
      if (isDistrict(d)) ctx.district = d
      else delete ctx.district
      if (isRoomsKey(r)) ctx.rooms = r
      else delete ctx.rooms
    }
    const hasContext = Object.keys(ctx).length > 0

    try {
      const res = await fetch('/api/public/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: String(data.get('name') ?? ''),
          phone: String(data.get('phone') ?? ''),
          message: String(data.get('message') ?? ''),
          company: String(data.get('company') ?? ''),
          consent: data.get('consent') === 'on',
          source,
          page,
          context: hasContext ? ctx : undefined,
        }),
      })

      const body = (await res.json().catch(() => ({}))) as { error?: string }

      if (!res.ok) {
        setError(body.error ?? 'Не удалось отправить заявку. Попробуйте позвонить нам.')
        setStatus('idle')
        return
      }

      form.reset()
      resetLeadContext()
      setDistrict('')
      setRooms('')
      setStatus('done')
    } catch {
      setError('Нет связи с сервером. Проверьте интернет или позвоните нам.')
      setStatus('idle')
    }
  }

  if (status === 'done') {
    return (
      <div
        className="p-6 border flex items-start gap-3"
        style={{
          background: 'var(--hp-good-tint)',
          borderColor: 'var(--hp-good)',
          borderRadius: 'var(--hp-radius)',
        }}
        role="status"
      >
        <Check style={{ width: 18, height: 18, marginTop: 2, flexShrink: 0, color: 'var(--hp-good)' }} />
        <div className="min-w-0">
          <p className="font-bold text-[15px]" style={{ color: 'var(--hp-good)' }}>
            Заявка у агента.
          </p>
          <p className="mt-1 text-[13.5px] leading-relaxed" style={{ color: 'var(--hp-ink)' }}>
            Перезвоним в течение {USLUGI.callback.withinMinutes} минут — с номера{' '}
            <a href={USLUGI_CONTACTS.phoneHref} className="font-semibold whitespace-nowrap">
              {USLUGI_CONTACTS.phone}
            </a>
            , чтобы вы не приняли звонок за спам.
          </p>
          <button
            type="button"
            onClick={() => setStatus('idle')}
            className="mt-3 text-[13px] font-semibold underline underline-offset-2"
            style={{ color: 'var(--hp-sub)' }}
          >
            Отправить ещё одну заявку
          </button>
        </div>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3"
      {...analyticsAttrs(ANALYTICS_EVENTS.leadSubmit, { source })}
    >
      {/* Honeypot: скрыт от людей, боты его заполняют */}
      <div aria-hidden="true" className="absolute w-px h-px overflow-hidden -left-[9999px]">
        <label htmlFor={`${USLUGI_ANCHORS.lead}-company`}>Не заполняйте это поле</label>
        <input id={`${USLUGI_ANCHORS.lead}-company`} type="text" name="company" tabIndex={-1} autoComplete="off" />
      </div>

      {summary && (
        <div
          className="flex items-start justify-between gap-3 px-4 py-2.5 border text-[13px]"
          style={{
            background: 'var(--hp-accent-tint)',
            borderColor: 'var(--hp-border)',
            color: 'var(--hp-ink)',
            borderRadius: 'var(--hp-radius)',
          }}
        >
          <span className="min-w-0 break-words">
            <span style={{ color: 'var(--hp-sub)' }}>В заявку уйдёт: </span>
            <span className="font-semibold">{summary}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              resetLeadContext()
              setDistrict('')
              setRooms('')
            }}
            aria-label="Убрать выбранные параметры из заявки"
            className="shrink-0 w-6 h-6 flex items-center justify-center"
            style={{ color: 'var(--hp-sub)' }}
          >
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="hp-label" htmlFor="uslugi-lead-name">Как к вам обращаться *</label>
          <input
            id="uslugi-lead-name"
            name="name"
            type="text"
            required
            minLength={2}
            maxLength={120}
            autoComplete="name"
            placeholder="Имя"
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label className="hp-label" htmlFor="uslugi-lead-phone">Телефон *</label>
          <input
            id="uslugi-lead-phone"
            name="phone"
            type="tel"
            required
            maxLength={30}
            autoComplete="tel"
            placeholder="+7 (___) ___-__-__"
            className={inputClass}
          />
        </div>
      </div>

      {withObjectFields && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="hp-label" htmlFor="uslugi-lead-district">Район</label>
            <select
              id="uslugi-lead-district"
              name="district"
              value={district}
              onChange={e => setDistrict(e.target.value)}
              className={selectClass}
            >
              <option value="">Не выбран</option>
              {DISTRICTS.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="hp-label" htmlFor="uslugi-lead-rooms">Комнат</label>
            <select
              id="uslugi-lead-rooms"
              name="rooms"
              value={rooms}
              onChange={e => setRooms(e.target.value)}
              className={selectClass}
            >
              <option value="">Не выбрано</option>
              {ROOMS_OPTIONS.map(o => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="hp-label" htmlFor="uslugi-lead-message">Что нужно</label>
        <textarea
          id="uslugi-lead-message"
          name="message"
          rows={3}
          maxLength={2000}
          placeholder={messagePlaceholder}
          className="w-full px-4 py-3 text-[14px] outline-none transition-colors resize-none border bg-[var(--hp-surface)] text-[var(--hp-ink)] placeholder:text-[var(--hp-tertiary)] border-[var(--hp-border)] focus:border-[var(--hp-ink)] rounded-[var(--hp-radius)]"
        />
      </div>

      {error && (
        <p
          role="alert"
          className="px-4 py-2.5 text-[13px] border"
          style={{
            background: 'var(--hp-danger-tint)',
            borderColor: 'var(--hp-danger)',
            color: 'var(--hp-danger)',
            borderRadius: 'var(--hp-radius)',
          }}
        >
          {error}
        </p>
      )}

      {/* Явная галочка: по 152-ФЗ согласие должно быть конкретным и подтверждаемым,
          факт его получения сохраняется вместе с заявкой (время + версия политики). */}
      <label className="flex items-start gap-2.5 text-[12px] leading-snug pt-1" style={{ color: 'var(--hp-sub)' }}>
        <input type="checkbox" name="consent" required className="mt-0.5 shrink-0" />
        <span>
          Я согласен(на) на обработку моих персональных данных в соответствии с{' '}
          <a href="/policy" target="_blank" rel="noopener noreferrer" className="underline">
            политикой обработки персональных данных
          </a>
          .
        </span>
      </label>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={status === 'sending'}
          className="hp-btn-primary justify-center disabled:opacity-60 h-11 shrink-0"
        >
          {status === 'sending' && <Loader2 className="w-4 h-4 animate-spin" />}
          {status === 'sending' ? 'Отправляем…' : submitLabel}
        </button>
        <p className="text-[12px] leading-snug" style={{ color: 'var(--hp-tertiary)' }}>
          {footnote}
        </p>
      </div>
    </form>
  )
}
