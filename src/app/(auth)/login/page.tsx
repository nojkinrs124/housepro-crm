import Link from 'next/link'
import { LoginForm } from '@/features/auth/components/LoginForm'
import { Building2, TrendingUp, Users, FileText, ArrowLeft } from 'lucide-react'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex" style={{ background: 'var(--hp-bg)' }}>
      {/* Left — брендинг: плоский акцентный цвет, без градиента и декоративных кругов */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12"
        style={{ background: 'var(--hp-accent)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 flex items-center justify-center shrink-0"
            style={{ background: 'rgba(255,255,255,0.16)', borderRadius: 'var(--hp-radius)' }}
          >
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-white font-bold text-[18px] leading-tight block tracking-tight">ХаусПро</span>
            <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.7)' }}>
              CRM
            </span>
          </div>
        </div>

        <div>
          <h1 className="text-[40px] font-bold text-white leading-[1.15] mb-5 tracking-tight">
            Управляйте недвижимостью эффективно
          </h1>
          <p className="text-[17px] leading-relaxed max-w-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>
            CRM агентства «ХаусПро». Клиенты, объекты, договоры и платежи — всё в одном месте.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Клиентов', value: '1 200+', icon: Users },
            { label: 'Договоров', value: '450+', icon: FileText },
            { label: 'Объектов', value: '890+', icon: TrendingUp },
          ].map((stat) => {
            const Icon = stat.icon
            return (
              <div
                key={stat.label}
                className="p-4"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 'var(--hp-radius)',
                }}
              >
                <Icon className="w-5 h-5 mb-2" style={{ color: 'rgba(255,255,255,0.8)' }} />
                <div className="text-[22px] font-bold text-white leading-tight">{stat.value}</div>
                <div className="text-xs font-medium mt-0.5" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  {stat.label}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Right — форма */}
      <div className="flex-1 flex flex-col p-6 sm:p-10">
        <Link href="/" className="hp-back-link inline-flex items-center gap-2 mb-8 lg:mb-4 self-start">
          <ArrowLeft style={{ width: 15, height: 15 }} />
          На сайт ХаусПро
        </Link>

        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-md">
            {/* Mobile logo */}
            <div className="flex items-center gap-3 mb-10 lg:hidden">
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
              <h2 className="text-[28px] font-bold tracking-tight leading-tight" style={{ color: 'var(--hp-ink)' }}>
                Вход в систему
              </h2>
              <p className="mt-1.5 text-sm font-medium" style={{ color: 'var(--hp-sub)' }}>
                Введите свои данные для входа
              </p>
            </div>

            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  )
}
