'use client'

import { useState, useTransition, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { login } from '../actions/auth.actions'

const loginSchema = z.object({
  email: z.string().email('Введите корректный email'),
  password: z.string().min(6, 'Минимум 6 символов'),
})

type LoginFormData = z.infer<typeof loginSchema>

// Отдельный компонент для useSearchParams — требует Suspense boundary
function LoginFormInner() {
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/dashboard'

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = (data: LoginFormData) => {
    setError(null)
    startTransition(async () => {
      const formData = new FormData()
      formData.append('email', data.email)
      formData.append('password', data.password)
      formData.append('redirectTo', redirectTo)

      const result = await login(formData)
      if (result?.error) {
        setError(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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
          Email
        </label>
        <input
          {...register('email')}
          id="email"
          type="email"
          placeholder="agent@housepro.ru"
          autoComplete="email"
          className="hp-input"
        />
        {errors.email && (
          <p className="text-[12px]" style={{ color: 'var(--hp-danger)' }}>{errors.email.message}</p>
        )}
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
            {...register('password')}
            id="password"
            type={showPassword ? 'text' : 'password'}
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
        {errors.password && (
          <p className="text-[12px]" style={{ color: 'var(--hp-danger)' }}>{errors.password.message}</p>
        )}
      </div>

      <button type="submit" disabled={isPending} className="hp-btn-primary w-full justify-center disabled:opacity-60 disabled:cursor-not-allowed">
        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        {isPending ? 'Вход...' : 'Войти'}
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
