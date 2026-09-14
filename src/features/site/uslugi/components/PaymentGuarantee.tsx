import { Check, ShieldCheck } from 'lucide-react'
import { USLUGI } from '../config'

/**
 * Экран 3 страницы «Сдать квартиру» — «Гарантия платежа» отдельным блоком.
 *
 * Тексты — дословно из docs/uslugi/sdat-kvartiru-texts.md, числа — только из
 * config.ts (`USLUGI.paymentGuarantee`). Интерактивности нет — серверный
 * компонент. Визуально сильнее соседних секций: карточка на всю ширину с
 * фоном accent-tint и акцентной границей.
 */

interface Props {
  /** id секции для якорных ссылок */
  id?: string
}

// ─── Склонения чисел из конфига ────────────────────────────────────────────
// Дублируют хелперы из TariffCards.tsx: тот файл клиентский, импортировать
// оттуда обычную функцию в серверный компонент нельзя.

/** Русское множественное число: pluralRu(5, ['день', 'дня', 'дней']) → «дней» */
function pluralRu(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return forms[2]
  if (last > 1 && last < 5) return forms[1]
  if (last === 1) return forms[0]
  return forms[2]
}

const RATES_WORDS: Record<number, string> = { 1: 'одной', 2: 'двух', 3: 'трёх' }

/** «до одной месячной ставки» / «до двух месячных ставок» / «до 4 месячных ставок» */
function monthlyRatesPhrase(n: number): string {
  const word = RATES_WORDS[n] ?? String(n)
  return n === 1 ? `${word} месячной ставки` : `${word} месячных ставок`
}

/** «один раз» / «2 раза» / «5 раз» */
function timesPhrase(n: number): string {
  if (n === 1) return 'один раз'
  return `${n} ${pluralRu(n, ['раз', 'раза', 'раз'])}`
}

const days = (n: number) => `${n} ${pluralRu(n, ['день', 'дня', 'дней'])}`
const months = (n: number) => `${n} ${pluralRu(n, ['месяц', 'месяца', 'месяцев'])}`

// ─── Тексты ────────────────────────────────────────────────────────────────

const { paymentGuarantee } = USLUGI

const HOW_IT_WORKS: readonly string[] = [
  `Просрочка больше ${days(paymentGuarantee.overdueDays)} — вы получаете компенсацию до ${monthlyRatesPhrase(paymentGuarantee.maxMonthlyRates)}`,
  'Выселением занимаемся мы: переговоры, уведомления, расторжение, при необходимости суд',
  `Компенсация выплачивается ${timesPhrase(paymentGuarantee.payoutsPerContract)} за срок договора`,
]

const WHEN_APPLIES: readonly string[] = [
  'Нанимателя подобрали мы',
  `Договор найма заключён на срок от ${months(paymentGuarantee.minContractMonths)}`,
  `Депозит с нанимателя — не меньше ${monthlyRatesPhrase(paymentGuarantee.minDepositMonthlyRates)}`,
  'Вы не договаривались с нанимателем об отсрочке самостоятельно и не заселяли жильца мимо нас',
]

// ─── Компонент ─────────────────────────────────────────────────────────────

function CheckList({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <div>
      <h3 className="text-[15px] font-bold" style={{ color: 'var(--hp-ink)' }}>
        {title}
      </h3>
      <ul className="mt-3 space-y-2.5">
        {items.map(item => (
          <li
            key={item}
            className="flex items-start gap-2.5 text-[13.5px] leading-relaxed"
            style={{ color: 'var(--hp-ink)' }}
          >
            <Check
              aria-hidden="true"
              style={{ width: 16, height: 16, marginTop: 2, color: 'var(--hp-accent)', flexShrink: 0 }}
            />
            <span className="break-words">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function PaymentGuarantee({ id }: Props) {
  return (
    <section id={id} className="scroll-mt-20 pt-16 sm:pt-20">
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6">
        <div
          className="p-5 sm:p-8 border"
          style={{
            background: 'var(--hp-accent-tint)',
            borderColor: 'var(--hp-accent)',
            borderRadius: 'var(--hp-radius)',
          }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-8">
            <div>
              <div
                className="inline-flex items-center justify-center w-12 h-12"
                style={{ background: 'var(--hp-surface)', borderRadius: 'var(--hp-radius)' }}
              >
                <ShieldCheck aria-hidden="true" style={{ width: 24, height: 24, color: 'var(--hp-accent)' }} />
              </div>
              <h2
                className="mt-5 text-[22px] sm:text-[26px] font-bold tracking-tight"
                style={{ color: 'var(--hp-ink)' }}
              >
                Наниматель не заплатил — платим мы
              </h2>
              <p
                className="mt-3 text-[14px] sm:text-[15px] leading-relaxed max-w-[640px]"
                style={{ color: 'var(--hp-ink)' }}
              >
                Собственник боится не сломанного смесителя. Он боится, что человек перестанет платить и будет
                сидеть в квартире, пока идёт суд. На тарифе «Премиум» этот риск переходит на нас.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <CheckList title="Как это работает:" items={HOW_IT_WORKS} />
              <CheckList title="Когда гарантия действует:" items={WHEN_APPLIES} />
            </div>
          </div>

          <p
            className="mt-8 pt-5 text-[13px] leading-relaxed border-t"
            style={{ borderColor: 'var(--hp-border)', color: 'var(--hp-sub)' }}
          >
            Условия гарантии прописаны в договоре с агентством — не «по договорённости», а текстом, который
            можно прочитать до подписания.
          </p>
        </div>
      </div>
    </section>
  )
}
