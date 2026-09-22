'use client'

import { useState, useTransition, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { looksLikePhone } from '@/lib/utils'
import { login } from '../actions/auth.actions'
import { requestPortalCodeAction, verifyPortalCodeAction } from '@/features/portal/actions/auth.actions'

/**
 * Единый вход: сотрудник по email и паролю, собственник и арендатор по
 * телефону с одноразовым кодом.
 *
 * Одно поле на оба случая, а не вкладки «сотрудник / клиент»: человек знает
 * свой email или свой телефон, но не знает, как называется его роль в нашей
 * системе. Что вводят, видно по самой строке — телефон в ней состоит из цифр.
 *
 * Пароль для сотрудника показан сразу и не прячется за лишним шагом: вход в
 * CRM — самое частое действие в системе, и разменивать его на удобство
 * редкого гостя нельзя.
 */
function LoginFormInner() {
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  /** Код запрошен — показываем поле ввода вместо кнопки «Получить код». */
  const [codeSent, setCodeSent] = useState(false)
  const [codeHint, setCodeHint] = useState<string | null>(null)

  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/dashboard'

  const phoneMode = looksLikePhone(identifier)

  function changeIdentifier(value: string) {
    setIdentifier(value)
    setError(null)
    // Сменили номер на email (или наоборот) — прежний шаг с кодом больше не
    // относится к тому, что сейчас в поле.
    if (codeSent) {
      setCodeSent(false)
      setCodeHint(null)
      setCode('')
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!identifier.trim()) {
      setError('Введите email или телефон')
      return
    }

    if (!phoneMode) {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(identifier.trim())) {
        setError('Введите корректный email или телефон')
        return
      }
      if (password.length < 6) {
        setError('Пароль — минимум 6 символов')
        return
      }

      startTransition(async () => {
        const formData = new FormData()
        formData.append('email', identifier.trim())
        formData.append('password', password)
        formData.append('redirectTo', redirectTo)

        const result = await login(formData)
        if (result?.error) setError(result.error)
      })
      return
    }

    if (!codeSent) {
      startTransition(async () => {
        const formData = new FormData()
        formData.append('phone', identifier)

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
      formData.append('phone', identifier)
      formData.append('code', code)

      // При успехе экшен уводит в кабинет и сюда не возвращается.
      const result = await verifyPortalCodeAction(formData)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <form onSubmit={submit} className="space-y-5">
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

      <div className="space-y-1.5">
        <label className="hp-label" htmlFor="email">
          Email или телефон
        </label>
        <input
          id="email"
          name="email"
          data-testid="login-email"
          type="text"
          inputMode="email"
          value={identifier}
          onChange={e => changeIdentifier(e.target.value)}
          placeholder="agent@housepro.ru или +7 900 123-45-67"
          autoComplete="username"
          className="hp-input"
        />
      </div>

      {!phoneMode && (
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
      )}

      {phoneMode && codeSent && (
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
          <p className="text-[12px]" style={{ color: 'var(--hp-sub)' }}>
            Если номер {codeHint ?? ''} привязан к объекту, код передаст ваш менеджер.
            Код действует несколько минут.
          </p>
        </div>
      )}

      <button
        type="submit"
        data-testid="login-submit"
        disabled={isPending}
        className="hp-btn-primary w-full justify-center disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        {isPending ? 'Проверяем…' : phoneMode && !codeSent ? 'Получить код' : 'Войти'}
      </button>
    </form>
  )
}

// Публичный экспорт — оборачивает в Suspense как требует Next.js
export function LoginForm() {
  return (
    <Suspense fallback={<div className="h-[220px] animate-pulse" style={{ background: 'var(--hp-neutral-tint)' }} />}>
      <LoginFormInner />
    </Suspense>
  )
}
