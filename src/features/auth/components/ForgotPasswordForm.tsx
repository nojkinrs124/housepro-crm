'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, MailCheck } from 'lucide-react'
import { resetPassword } from '../actions/auth.actions'

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim()) {
      setError('Введите email')
      return
    }
    startTransition(async () => {
      const formData = new FormData()
      formData.set('email', email.trim())
      const result = await resetPassword(formData)
      if (result?.error) setError(result.error)
      else setSent(true)
    })
  }

  if (sent) {
    return (
      <div className="space-y-5 text-center">
        <div
          className="w-14 h-14 flex items-center justify-center mx-auto"
          style={{ background: 'var(--hp-good-tint)', borderRadius: 'var(--hp-radius)' }}
        >
          <MailCheck style={{ width: 24, height: 24, color: 'var(--hp-good)' }} />
        </div>
        <div>
          <p className="font-bold text-base" style={{ color: 'var(--hp-ink)' }}>Проверьте почту</p>
          <p className="text-sm mt-1" style={{ color: 'var(--hp-sub)' }}>
            Если аккаунт с email «{email}» существует — мы отправили на него ссылку для сброса пароля.
          </p>
        </div>
        <Link href="/login" className="hp-back-link inline-flex items-center justify-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Вернуться ко входу
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
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

      <div className="space-y-1.5">
        <label className="hp-label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="agent@housepro.ru"
          autoComplete="email"
          className="hp-input"
        />
      </div>

      <button type="submit" disabled={isPending} className="hp-btn-primary w-full justify-center disabled:opacity-60 disabled:cursor-not-allowed">
        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        {isPending ? 'Отправка...' : 'Отправить ссылку для сброса'}
      </button>

      <Link href="/login" className="flex items-center justify-center gap-2 text-sm font-medium transition-colors hover:opacity-80" style={{ color: 'var(--hp-sub)' }}>
        <ArrowLeft className="w-4 h-4" />
        Вернуться ко входу
      </Link>
    </form>
  )
}
