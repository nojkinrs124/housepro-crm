import Link from 'next/link'
import { LoginGate } from '@/features/auth/components/LoginGate'
import { Building2, ArrowLeft } from 'lucide-react'

/**
 * Вход — одна дверь для двух очень разных людей.
 *
 * Сотрудник агентства приходит сюда каждый день и не читает ничего, кроме
 * полей. Собственник или арендатор — раз в месяц, впервые, и ему неочевидно
 * всё: куда он попал, при чём тут «CRM», откуда возьмётся код и что он
 * увидит внутри. Раньше страница разговаривала только с первым: половину
 * экрана занимала витрина с выдуманными цифрами «1 200+ клиентов», а на
 * телефоне, откуда и заходят жильцы, она вообще не показывалась.
 *
 * Теперь экран называет обоих и спрашивает, кто пришёл (LoginGate), а поля
 * показывает только те, что нужны выбранному. Колонка одна и по центру — как
 * на /forgot-password и /reset-password: экраны входа наконец выглядят одной
 * группой.
 */
export default function LoginPage() {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-6 py-20" style={{ background: 'var(--hp-bg)' }}>
      <Link href="/" className="hp-back-link absolute top-6 left-6 inline-flex items-center gap-2">
        <ArrowLeft style={{ width: 15, height: 15 }} />
        На сайт ХаусПро
      </Link>

      <div className="w-full max-w-xl">
        <div className="flex flex-col items-center text-center gap-3 mb-8">
          <div
            className="w-12 h-12 flex items-center justify-center shrink-0"
            style={{ background: 'var(--hp-accent)', borderRadius: 'var(--hp-radius)' }}
          >
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="font-bold text-[19px] leading-tight block tracking-tight" style={{ color: 'var(--hp-ink)' }}>
              ХаусПро
            </span>
            {/* Не «CRM»: собственнику это слово ничего не говорит, а он тут
                такой же свой, как и сотрудник. */}
            <span className="text-[11.5px] font-medium" style={{ color: 'var(--hp-sub)' }}>
              агентство недвижимости
            </span>
          </div>

          <h1 className="text-[30px] font-bold tracking-tight leading-tight mt-2" style={{ color: 'var(--hp-ink)' }}>
            Вход
          </h1>
        </div>

        <LoginGate />
      </div>
    </div>
  )
}
