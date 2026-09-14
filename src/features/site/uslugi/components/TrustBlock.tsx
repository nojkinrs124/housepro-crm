import { BadgeCheck, FileCheck, MapPin } from 'lucide-react'
import { TRUST } from '../config'
import { Testimonials } from './Testimonials'

/**
 * Экран 8 страницы «Сдать квартиру» — «Кто ведёт вашу квартиру».
 *
 * Тексты — дословно из docs/uslugi/sdat-kvartiru-texts.md, числа и реквизиты —
 * только из TRUST в config.ts. Серверный компонент: интерактивности нет.
 * Внизу — слот под отзывы (Testimonials), пока пустой.
 */

interface Props {
  /** id секции для якорных ссылок */
  id?: string
  /**
   * Живые цифры из CRM (fetchSiteStats). Без них — базовые значения из TRUST;
   * страница передаёт их, чтобы блок рос вместе с данными, а не с константой.
   */
  stats?: { closedDeals: number; objectsInManagement: number }
}

const POINTS = [
  {
    Icon: FileCheck,
    text: 'Работаем только по договору — комиссия названа до начала работы',
  },
  {
    Icon: BadgeCheck,
    text: `Реквизиты открыто: ${TRUST.legalName}, ИНН ${TRUST.inn}`,
  },
  {
    Icon: MapPin,
    text: `${TRUST.address}. ${TRUST.workingHours}`,
  },
]

export function TrustBlock({ id, stats }: Props) {
  const closedDeals = stats?.closedDeals ?? TRUST.closedDeals
  const objectsInManagement = stats?.objectsInManagement ?? TRUST.objectsInManagement
  const STATS = [
    { label: 'В недвижимости', value: `с ${TRUST.sinceYear} года` },
    { label: 'Закрытых сделок', value: `больше ${closedDeals}` },
    { label: 'Квартир в управлении', value: String(objectsInManagement) },
  ]

  return (
    <section id={id} className="scroll-mt-20 pt-16 sm:pt-20">
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6">
        <h2 className="text-[22px] sm:text-[26px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
          Кто ведёт вашу квартиру
        </h2>

        <div className="mt-8 hp-strip" style={{ gridTemplateColumns: `repeat(${STATS.length}, minmax(0, 1fr))` }}>
          {STATS.map(stat => (
            <div key={stat.label} className="hp-strip-cell">
              <p className="hp-strip-label">{stat.label}</p>
              <p className="hp-strip-value">{stat.value}</p>
            </div>
          ))}
        </div>

        <ul className="mt-6 space-y-3">
          {POINTS.map(({ Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-[14px] sm:text-[15px] leading-relaxed" style={{ color: 'var(--hp-ink)' }}>
              <span
                aria-hidden="true"
                className="flex items-center justify-center shrink-0"
                style={{
                  width: 32,
                  height: 32,
                  background: 'var(--hp-accent-tint)',
                  color: 'var(--hp-accent)',
                  borderRadius: 'var(--hp-radius)',
                }}
              >
                <Icon style={{ width: 16, height: 16 }} />
              </span>
              <span className="pt-1 break-words">{text}</span>
            </li>
          ))}
        </ul>

        <Testimonials items={[]} />
      </div>
    </section>
  )
}
