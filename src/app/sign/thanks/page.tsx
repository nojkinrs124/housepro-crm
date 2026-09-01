import { CheckCircle2 } from 'lucide-react'

// Страница возврата после подписания в Подпислоне.
//
// Сервис перебрасывает сюда клиента (redirect_url), поэтому страница публичная —
// префикс '/sign/' исключён из авторизации в middleware. Ничего не запрашивает
// и ничего не показывает из данных договора: у пришедшего сюда человека нет
// токена, а значит, и права видеть содержимое сделки.

export const metadata = { title: 'Документ подписан' }

export default function SignThanksPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--hp-bg)] px-4">
      <div className="bg-[var(--hp-surface)] rounded-[var(--hp-radius)] border border-[var(--hp-border)] p-5 max-w-md w-full text-center space-y-3">
        <div className="w-14 h-14 rounded-[var(--hp-radius)] flex items-center justify-center mx-auto bg-[var(--hp-good-tint)] border border-[var(--hp-border)]">
          <CheckCircle2 style={{ width: 24, height: 24, color: 'var(--hp-good)' }} />
        </div>
        <h1 className="text-[27px] font-bold text-[var(--hp-ink)] tracking-tight leading-tight">
          Документ подписан
        </h1>
        <p className="text-[var(--hp-sub)] text-sm font-medium">
          Подписанный экземпляр придёт вам от сервиса электронной подписи.
          Копия хранится у агентства — её можно запросить в любой момент.
        </p>
      </div>
    </div>
  )
}
