import type { Metadata } from 'next'
import Link from 'next/link'
import { logoutPortalAction } from '@/features/portal/actions/auth.actions'

export const metadata: Metadata = {
  title: 'Личный кабинет — ХаусПро',
  // Кабинет не должен попадать в поиск: за адресом стоят персональные данные.
  robots: { index: false, follow: false },
}

/**
 * Макет личного кабинета.
 *
 * Отдельный от CRM намеренно: здесь нет бокового меню, поиска и всего, что
 * подразумевает сотрудника. Посетитель видит только свой объект.
 */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--hp-bg)]">
      <header className="border-b border-[var(--hp-border)] bg-[var(--hp-surface)]">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between gap-4">
          <Link href="/cabinet" className="font-bold text-[var(--hp-ink)] text-[17px] tracking-tight">
            ХаусПро
            <span className="ml-2 font-normal text-[13px] text-[var(--hp-sub)]">личный кабинет</span>
          </Link>
          <form action={logoutPortalAction}>
            <button type="submit" className="text-[13px] text-[var(--hp-sub)] hover:text-[var(--hp-ink)] transition-colors">
              Выйти
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 space-y-6">{children}</main>

      <footer className="mx-auto max-w-4xl px-4 py-8 text-[12px] text-[var(--hp-tertiary)]">
        Вопросы по объекту — вашему менеджеру в агентстве.
      </footer>
    </div>
  )
}
