import { ResetPasswordForm } from '@/features/auth/components/ResetPasswordForm'
import { BrandMark } from '@/components/brand/BrandMark'

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 sm:p-10" style={{ background: 'var(--hp-bg)' }}>
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-10">
          <BrandMark size={44} />
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
            Новый пароль
          </h1>
          <p className="mt-1.5 text-sm font-medium" style={{ color: 'var(--hp-sub)' }}>
            Придумайте новый пароль для входа в аккаунт
          </p>
        </div>

        <ResetPasswordForm />
      </div>
    </div>
  )
}
