'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { requestPortalCodeAction, verifyPortalCodeAction } from '@/features/portal/actions/auth.actions'

/**
 * Вход в кабинет по телефону и одноразовому коду.
 *
 * Два шага в одной форме: номер → код. Ответ на запрос кода одинаков для
 * существующего и несуществующего номера — иначе форма превращается в способ
 * узнать, работает ли человек с агентством.
 */
export function PortalLoginForm() {
  const [pending, start] = useTransition()
  const [phone, setPhone] = useState('')
  const [sent, setSent] = useState(false)
  const [hint, setHint] = useState<string | null>(null)

  function request(formData: FormData) {
    start(async () => {
      const res = await requestPortalCodeAction(formData)
      if (res.error) {
        toast.error(res.error)
        return
      }
      setSent(true)
      setHint(res.maskedTarget ?? null)
    })
  }

  function verify(formData: FormData) {
    start(async () => {
      const res = await verifyPortalCodeAction(formData)
      // При успехе экшен делает redirect и сюда не возвращается.
      if (res?.error) toast.error(res.error)
    })
  }

  return (
    <div className="hp-card p-5 space-y-4">
      <div className="space-y-1">
        <h1 className="font-bold text-[var(--hp-ink)] text-[17px]">Вход в кабинет</h1>
        <p className="text-sm text-[var(--hp-sub)]">
          По номеру телефона, который вы оставляли в агентстве
        </p>
      </div>

      {!sent ? (
        <form action={request} className="space-y-4">
          <div className="space-y-1.5">
            <label className="hp-label" htmlFor="phone">Телефон</label>
            <input
              id="phone" name="phone" type="tel" required autoComplete="tel"
              value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="+7 900 123-45-67" className="hp-input"
            />
          </div>
          <button type="submit" disabled={pending} className="hp-btn-primary w-full justify-center">
            {pending ? 'Отправляем…' : 'Получить код'}
          </button>
        </form>
      ) : (
        <form action={verify} className="space-y-4">
          <input type="hidden" name="phone" value={phone} />
          <p className="text-sm text-[var(--hp-sub)]">
            Если номер {hint ?? ''} привязан к объекту, код передаст ваш менеджер.
            Код действует несколько минут.
          </p>
          <div className="space-y-1.5">
            <label className="hp-label" htmlFor="code">Код из шести цифр</label>
            <input
              id="code" name="code" inputMode="numeric" pattern="\d{6}" maxLength={6} required
              autoComplete="one-time-code" placeholder="000000" className="hp-input"
            />
          </div>
          <button type="submit" disabled={pending} className="hp-btn-primary w-full justify-center">
            {pending ? 'Проверяем…' : 'Войти'}
          </button>
          <button
            type="button"
            onClick={() => { setSent(false); setHint(null) }}
            className="w-full text-[13px] text-[var(--hp-sub)] hover:text-[var(--hp-ink)] transition-colors"
          >
            Ввести другой номер
          </button>
        </form>
      )}
    </div>
  )
}
