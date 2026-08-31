'use client'

import { useState } from 'react'
import { Loader2, Check } from 'lucide-react'

interface Props {
  /** id объекта, если форма стоит на карточке объекта */
  propertyId?: string
  /** Подставляется в поле «Сообщение» при открытии формы */
  defaultMessage?: string
  submitLabel?: string
  /** Компактный режим — без поля e-mail (хиро на главной) */
  compact?: boolean
}

const inputClass =
  'w-full h-11 px-4 text-[14px] outline-none transition-colors border bg-[var(--hp-surface)] text-[var(--hp-ink)] placeholder:text-[var(--hp-tertiary)] border-[var(--hp-border)] focus:border-[var(--hp-ink)] rounded-[var(--hp-radius)]'

export function LeadForm({
  propertyId,
  defaultMessage = '',
  submitLabel = 'Отправить заявку',
  compact = false,
}: Props) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setStatus('sending')

    const form = e.currentTarget
    const data = new FormData(form)

    try {
      const res = await fetch('/api/public/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: String(data.get('name') ?? ''),
          phone: String(data.get('phone') ?? ''),
          email: String(data.get('email') ?? ''),
          message: String(data.get('message') ?? ''),
          property_id: propertyId ?? '',
          company: String(data.get('company') ?? ''),
        }),
      })

      const body = (await res.json().catch(() => ({}))) as { error?: string }

      if (!res.ok) {
        setError(body.error ?? 'Не удалось отправить заявку. Попробуйте позвонить нам.')
        setStatus('idle')
        return
      }

      form.reset()
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
      >
        <Check style={{ width: 18, height: 18, marginTop: 2, flexShrink: 0, color: 'var(--hp-good)' }} />
        <div className="min-w-0">
          <p className="font-bold text-[15px]" style={{ color: 'var(--hp-good)' }}>
            Заявка принята
          </p>
          <p className="mt-1 text-[13.5px] leading-relaxed" style={{ color: 'var(--hp-ink)' }}>
            Агент перезвонит в рабочее время — обычно в течение часа. Если вопрос срочный,
            позвоните сами, номер в шапке страницы.
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
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Honeypot: скрыт от людей, боты его заполняют */}
      <div aria-hidden="true" className="absolute w-px h-px overflow-hidden -left-[9999px]">
        <label htmlFor="company-hp">Не заполняйте это поле</label>
        <input id="company-hp" type="text" name="company" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="hp-label" htmlFor="lead-name">Как к вам обращаться *</label>
          <input
            id="lead-name"
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
          <label className="hp-label" htmlFor="lead-phone">Телефон *</label>
          <input
            id="lead-phone"
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

      {!compact && (
        <div className="space-y-1.5">
          <label className="hp-label" htmlFor="lead-email">E-mail</label>
          <input
            id="lead-email"
            name="email"
            type="email"
            maxLength={160}
            autoComplete="email"
            placeholder="Если удобнее письмом"
            className={inputClass}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <label className="hp-label" htmlFor="lead-message">Что нужно</label>
        <textarea
          id="lead-message"
          name="message"
          rows={compact ? 2 : 4}
          maxLength={2000}
          defaultValue={defaultMessage}
          placeholder="Например: ищу двушку в Советском районе до 40 000 ₽, заезд с 1 числа"
          className="w-full px-4 py-3 text-[14px] outline-none transition-colors resize-none border bg-[var(--hp-surface)] text-[var(--hp-ink)] placeholder:text-[var(--hp-tertiary)] border-[var(--hp-border)] focus:border-[var(--hp-ink)] rounded-[var(--hp-radius)]"
        />
      </div>

      {error && (
        <p
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
          Нажимая кнопку, вы соглашаетесь на обработку контактных данных
          для ответа на обращение.
        </p>
      </div>
    </form>
  )
}
