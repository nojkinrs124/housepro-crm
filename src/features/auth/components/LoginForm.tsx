'use client'

import { useState, useTransition, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { login } from '../actions/auth.actions'
import { requestPortalCodeAction, verifyPortalCodeAction } from '@/features/portal/actions/auth.actions'

export type Audience = 'staff' | 'client'

/**
 * Форма входа для уже выбранной роли.
 *
 * Кто входит, решено дверью на экране выше (LoginGate) — здесь спрашиваем
 * только то, что нужно этому человеку: у сотрудника рабочий email и пароль, у
 * собственника или арендатора номер телефона и код. Показывать клиенту поле
 * пароля нельзя: пароля ему не выдают, и увидев его, он решает, что кабинет
 * не для него.
 */
function LoginFormInner({ audience }: { audience: Audience }) {
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  /** Код запрошен — показываем поле ввода вместо кнопки «Получить код». */
  const [codeSent, setCodeSent] = useState(false)
  const [codeHint, setCodeHint] = useState<string | null>(null)

  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/dashboard'

  function submitStaff() {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError('Введите рабочий email')
      return
    }
    if (password.length < 6) {
      setError('Пароль — минимум 6 символов')
      return
    }

    startTransition(async () => {
      const formData = new FormData()
      formData.append('email', email.trim())
      formData.append('password', password)
      formData.append('redirectTo', redirectTo)

      const result = await login(formData)
      if (result?.error) setError(result.error)
    })
  }

  function submitClient() {
    if (!codeSent) {
      if (phone.replace(/\D/g, '').length < 10) {
        setError('Введите номер телефона полностью')
        return
      }

      startTransition(async () => {
        const formData = new FormData()
        formData.append('phone', phone)

        const result = await requestPortalCodeAction(formData)
        if (result.error) {
          setError(result.error)
          return
        }
        setCodeSent(true)
        setCodeHint(result.maskedTarget ?? null)
      })
      return
    }

    if (!/^\d{6}$/.test(code)) {
      setError('Код состоит из шести цифр')
      return
    }

    startTransition(async () => {
      const formData = new FormData()
      formData.append('phone', phone)
      formData.append('code', code)

      // При успехе экшен уводит в кабинет и сюда не возвращается.
      const result = await verifyPortalCodeAction(formData)
      if (result?.error) setError(result.error)
    })
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (audience === 'staff') submitStaff()
    else submitClient()
  }

  const buttonLabel = isPending
    ? 'Проверяем…'
    : audience === 'client' && !codeSent
      ? 'Получить код'
      : 'Войти'

  return (
    <form onSubmit={submit} className="space-y-5 text-left">
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
          {error === 'Invalid login credentials' ? 'Неверный email или пароль' : error}
        </p>
      )}

      {audience === 'staff' ? (
        <>
          <div className="space-y-1.5">
            <label className="hp-label" htmlFor="email">Рабочий email</label>
            <input
              id="email"
              name="email"
              data-testid="login-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="agent@housepro.ru"
              autoComplete="email"
              className="hp-input"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11.5px] font-semibold" htmlFor="password" style={{ color: 'var(--hp-sub)' }}>
                Пароль
              </label>
              <Link href="/forgot-password" className="text-xs font-semibold transition-colors hover:opacity-80" style={{ color: 'var(--hp-accent)' }}>
                Забыли пароль?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                name="password"
                data-testid="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="hp-input"
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: 'var(--hp-tertiary)' }}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-1.5">
            <label className="hp-label" htmlFor="phone">Номер телефона</label>
            <input
              id="phone"
              name="phone"
              data-testid="login-phone"
              type="tel"
              value={phone}
              onChange={e => { setPhone(e.target.value); if (codeSent) { setCodeSent(false); setCode('') } }}
              placeholder="+7 900 123-45-67"
              autoComplete="tel"
              className="hp-input"
            />
            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--hp-sub)' }}>
              Тот номер, который вы оставляли в агентстве.
            </p>
          </div>

          {codeSent && (
            <div className="space-y-1.5">
              <label className="hp-label" htmlFor="code">Код из шести цифр</label>
              <input
                id="code"
                name="code"
                data-testid="login-code"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="000000"
                autoComplete="one-time-code"
                className="hp-input"
              />
              {/* Формулировка одинакова для знакомого и незнакомого номера: по
                  разнице ответов форму входа можно было бы использовать как
                  способ проверять, работает ли человек с агентством. */}
              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--hp-sub)' }}>
                Если номер {codeHint ?? ''} привязан к объекту, код назовёт ваш менеджер.
                СМС не придёт — автоматической отправки пока нет. Код действует несколько минут.
              </p>
            </div>
          )}
        </>
      )}

      <button
        type="submit"
        data-testid="login-submit"
        disabled={isPending}
        className="hp-btn-primary w-full justify-center disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        {buttonLabel}
      </button>
    </form>
  )
}

// Публичный экспорт — оборачивает в Suspense как требует Next.js
export function LoginForm({ audience }: { audience: Audience }) {
  return (
    <Suspense fallback={<div className="h-[220px] animate-pulse" style={{ background: 'var(--hp-neutral-tint)' }} />}>
      <LoginFormInner audience={audience} />
    </Suspense>
  )
}
