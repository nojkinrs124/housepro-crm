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
        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-xl px-4 py-3">
          {error === 'Invalid login credentials'
            ? 'Неверный email или пароль'
            : error}
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground" htmlFor="email">
          Email
        </label>
        <input
          {...register('email')}
          id="email"
          type="email"
          placeholder="agent@housepro.ru"
          autoComplete="email"
          className="w-full h-11 px-4 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm"
        />
        {errors.email && (
          <p className="text-destructive text-xs">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground" htmlFor="password">
            Пароль
          </label>
          <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
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
            className="w-full h-11 px-4 pr-11 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errors.password && (
          <p className="text-destructive text-xs">{errors.password.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full h-11 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        {isPending ? 'Вход...' : 'Войти'}
      </button>
    </form>
  )
}

// Публичный экспорт — оборачивает в Suspense как требует Next.js
export function LoginForm() {
  return (
    <Suspense fallback={<div className="h-[220px] animate-pulse bg-gray-100 rounded-xl" />}>
      <LoginFormInner />
    </Suspense>
  )
}
