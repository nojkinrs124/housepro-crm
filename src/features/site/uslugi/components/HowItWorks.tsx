import { USLUGI } from '../config'

/**
 * Экран 5 страницы «Сдать квартиру» — «Пять шагов от звонка до первых денег».
 *
 * Тексты — дословно из docs/uslugi/sdat-kvartiru-texts.md, числа в подписи —
 * только из config.ts (`USLUGI.timing`). Интерактивности нет — серверный
 * компонент.
 */

interface Props {
  /** id секции для якорных ссылок */
  id?: string
}

// ─── Склонения чисел из конфига ────────────────────────────────────────────
// Дублирует хелпер из TariffCards.tsx: тот файл клиентский, импортировать
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

const days = (n: number) => `${n} ${pluralRu(n, ['день', 'дня', 'дней'])}`
const minutes = (n: number) => `${n} ${pluralRu(n, ['минуту', 'минуты', 'минут'])}`

// ─── Тексты ────────────────────────────────────────────────────────────────

interface Step {
  title: string
  text: string
}

const STEPS: readonly Step[] = [
  {
    title: 'Разговор, 10 минут.',
    text: 'Рассказываете про квартиру. Называем ориентир по ставке и подходящий тариф. Бесплатно и ни к чему не обязывает.',
  },
  {
    title: 'Осмотр и съёмка.',
    text: 'Приезжаем, смотрим квартиру, фотографируем, согласуем финальную ставку и дату выхода в рекламу.',
  },
  {
    title: 'Договор с агентством.',
    text: 'Подписываем: тариф, размер комиссии, сроки, что мы обязаны делать. Никаких доплат «за оформление» потом.',
  },
  {
    title: 'Поиск и проверка.',
    text: 'Реклама, звонки, показы, проверка кандидатов. Кандидата показываем вам — заселяем только того, кого одобрили вы.',
  },
  {
    title: 'Заселение.',
    text: 'Договор найма, акт с описью, ключи, деньги. Дальше — по тарифу: либо квартира ваша, либо наша забота.',
  },
]

const { timing } = USLUGI

// ─── Компонент ─────────────────────────────────────────────────────────────

export function HowItWorks({ id }: Props) {
  return (
    <section id={id} className="scroll-mt-20 pt-16 sm:pt-20">
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6">
        <h2 className="text-[22px] sm:text-[26px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
          Пять шагов от звонка до первых денег
        </h2>

        <ol className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="p-5 sm:p-6 flex flex-col border"
              style={{
                background: 'var(--hp-surface)',
                borderColor: 'var(--hp-border)',
                borderRadius: 'var(--hp-radius)',
              }}
            >
              <span
                aria-hidden="true"
                className="text-[28px] font-bold leading-none tracking-tight"
                style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: 'var(--hp-accent)' }}
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-4 text-[15px] font-bold" style={{ color: 'var(--hp-ink)' }}>
                {step.title}
              </h3>
              <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: 'var(--hp-sub)' }}>
                {step.text}
              </p>
            </li>
          ))}
        </ol>

        <p
          className="mt-6 text-[14px] sm:text-[15px] leading-relaxed max-w-[720px]"
          style={{ color: 'var(--hp-sub)' }}
        >
          Нанимателя обычно находим за {days(timing.tenantSearchDays)}. Самого заселения ждать не нужно: если
          квартира понравилась на показе, договор и акт готовим на месте — {minutes(timing.moveInMinutes)}, и
          человек заезжает.
        </p>
      </div>
    </section>
  )
}
