import Link from 'next/link'
import { ForgotPasswordForm } from '@/features/auth/components/ForgotPasswordForm'
import { Building2, ArrowLeft } from 'lucide-react'

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col p-6 sm:p-10" style={{ background: 'var(--hp-bg)' }}>
      <Link href="/login" className="hp-back-link inline-flex items-center gap-2 mb-8 self-start">
        <ArrowLeft style={{ width: 15, height: 15 }} />
        Вернуться ко входу
      </Link>

      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-10">
            <div
              className="w-11 h-11 flex items-center justify-center shrink-0"
              style={{ background: 'var(--hp-accent)', borderRadius: 'var(--hp-radius)' }}
            >
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="font-bold text-[18px] leading-tight block tracking-tight" style={{ color: 'var(--hp-ink)' }}>
                ХаусПро
              </span>
              <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--hp-sub)' }}>
                CRM
              </span>
            </div>
          </div>

          <div className="mb-8">
            <h1 className="text-[28px] font-bold tracking-tight leading-tight" style={{ color: 'var(--hp-ink)' }}>
              Восстановление пароля
            </h1>
            <p className="mt-1.5 text-sm font-medium" style={{ color: 'var(--hp-sub)' }}>
              Укажите email, привязанный к аккаунту — пришлём ссылку для сброса пароля
            </p>
          </div>

          <ForgotPasswordForm />
        </div>
      </div>
    </div>
  )
}
