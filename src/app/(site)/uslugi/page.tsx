import type { Metadata } from 'next'
import { Check, KeyRound, Building2, ShieldCheck } from 'lucide-react'
import { LeadForm } from '@/features/site/components/LeadForm'

export const metadata: Metadata = {
  title: 'Тарифы для собственников — ХаусПро, Красноярск',
  description:
    'Три тарифа сдачи квартиры в аренду: разовый подбор нанимателя, ежемесячное управление и управление с полной защитой. Что входит в каждый тариф и сколько это стоит.',
}

interface Tariff {
  Icon: typeof KeyRound
  slug: string
  eyebrow: string
  title: string
  lead: string
  priceValue: string
  priceNote: string
  badge?: string
  includesFrom?: string
  features: string[]
  highlighted?: boolean
}

const TARIFFS: Tariff[] = [
  {
    Icon: KeyRound,
    slug: 'agent',
    eyebrow: 'Тариф 1',
    title: 'Агент по недвижимости',
    lead: 'Разовая сделка: находим и заселяем нанимателя, дальше вы работаете с ним сами.',
    priceValue: '25%',
    priceNote: 'от суммы сделки, разово при заселении',
    badge: 'Первая сделка — бесплатно',
    features: [
      'Размещение рекламы объекта на площадках',
      'Поиск потенциальных арендаторов',
      'Проверка арендатора по всем доступным базам',
      'Гарантия надёжности арендатора',
      'Подготовка документов: договор, акт и сопутствующие бумаги',
      'Заселение арендатора, передача ключей',
    ],
  },
  {
    Icon: Building2,
    slug: 'upravlenie',
    eyebrow: 'Тариф 2',
    title: 'Управление',
    lead: 'Вы получаете деньги за аренду, мы занимаемся квартирой и арендаторами.',
    priceValue: '10%',
    priceNote: 'от ежемесячного платежа',
    includesFrom: 'Всё из тарифа «Агент», плюс:',
    highlighted: true,
    features: [
      'Смена арендаторов: заселение и выселение',
      'Плановая проверка состояния квартиры',
      'Поиск нового арендатора при смене нанимателя',
      'Генеральная уборка между нанимателями',
      'Мелкий ремонт за наш счёт — до 5 000 ₽ (смесители, электрика и подобное)',
      'Полная отчётность по сдаче',
      'Стабильные переводы арендной платы собственнику',
      'Решение любых вопросов по квартире и с арендаторами',
    ],
  },
  {
    Icon: ShieldCheck,
    slug: 'upravlenie-premium',
    eyebrow: 'Тариф 3',
    title: 'Управление Премиум',
    lead: 'Максимальная защита объекта — вы не думаете о квартире вообще.',
    priceValue: '15%',
    priceNote: 'от ежемесячного платежа',
    includesFrom: 'Всё из тарифа «Управление», плюс:',
    features: [
      'Полная страховка квартиры — затопление, порча имущества и другие риски',
      'Все вопросы с управляющей компанией берём на себя',
      'Выезд на объект для решения проблем в любое время, включая ночь и выходные',
      'Персональный менеджер на связи 24/7',
      'Ежегодный пересмотр ставки аренды по рынку, чтобы доход не отставал от рынка',
    ],
  },
]

export default function ServicesPage() {
  return (
    <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <header className="max-w-[720px]">
        <h1
          className="text-[30px] sm:text-[40px] font-bold tracking-tight leading-tight"
          style={{ color: 'var(--hp-ink)' }}
        >
          Тарифы для собственников
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed" style={{ color: 'var(--hp-sub)' }}>
          Три тарифа сдачи квартиры в аренду — от разового подбора нанимателя до полного
          управления объектом. Каждый тариф фиксируется в договоре: что именно входит
          и сколько это стоит, известно заранее.
        </p>
      </header>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        {TARIFFS.map(({ Icon, slug, eyebrow, title, lead, priceValue, priceNote, badge, includesFrom, features, highlighted }) => (
          <section
            key={slug}
            id={slug}
            className="p-5 sm:p-6 flex flex-col h-full scroll-mt-20"
            style={{
              background: 'var(--hp-surface)',
              border: `1px solid ${highlighted ? 'var(--hp-accent)' : 'var(--hp-border)'}`,
              borderRadius: 'var(--hp-radius)',
            }}
          >
            {highlighted && (
              <span className="hp-badge hp-badge-good self-start mb-3">Оптимальный выбор</span>
            )}

            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 flex items-center justify-center shrink-0 border"
                style={{
                  background: 'var(--hp-neutral-tint)',
                  borderColor: 'var(--hp-border)',
                  borderRadius: 'var(--hp-radius)',
                }}
              >
                <Icon style={{ width: 18, height: 18, color: 'var(--hp-ink)' }} />
              </div>
              <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: 'var(--hp-tertiary)' }}>
                {eyebrow}
              </span>
            </div>

            <h2 className="mt-3 text-[21px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
              {title}
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed" style={{ color: 'var(--hp-sub)' }}>
              {lead}
            </p>

            <div className="mt-5 pt-5 border-t" style={{ borderColor: 'var(--hp-border-soft)' }}>
              {badge && (
                <span className="hp-badge hp-badge-warn mb-2">{badge}</span>
              )}
              <div className="flex items-baseline gap-2">
                <span
                  className="text-[34px] font-bold tracking-tight"
                  style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: 'var(--hp-ink)' }}
                >
                  {priceValue}
                </span>
                <span className="text-[13px] font-medium" style={{ color: 'var(--hp-sub)' }}>
                  {priceNote}
                </span>
              </div>
            </div>

            <div className="mt-5 flex-1">
              {includesFrom && (
                <p className="text-[12.5px] font-semibold mb-3" style={{ color: 'var(--hp-accent)' }}>
                  {includesFrom}
                </p>
              )}
              <ul className="space-y-2.5">
                {features.map(item => (
                  <li key={item} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed" style={{ color: 'var(--hp-ink)' }}>
                    <Check style={{ width: 15, height: 15, marginTop: 2, color: 'var(--hp-accent)', flexShrink: 0 }} />
                    <span className="break-words">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <a
              href="#zayavka"
              className={highlighted ? 'hp-btn-primary justify-center mt-6' : 'hp-btn-secondary justify-center mt-6'}
            >
              Оставить заявку
            </a>
          </section>
        ))}
      </div>

      <section
        id="zayavka"
        className="mt-10 border p-5 sm:p-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-8 scroll-mt-20"
        style={{
          background: 'var(--hp-surface)',
          borderColor: 'var(--hp-border)',
          borderRadius: 'var(--hp-radius)',
        }}
      >
        <div className="min-w-0">
          <h2 className="text-[22px] sm:text-[26px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
            Не знаете, какой тариф подойдёт?
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed" style={{ color: 'var(--hp-sub)' }}>
            Опишите квартиру и ситуацию своими словами — агент подскажет подходящий тариф
            и посчитает стоимость. Консультация до заключения договора бесплатная.
          </p>
        </div>
        <div className="min-w-0">
          <LeadForm submitLabel="Отправить заявку" />
        </div>
      </section>
    </div>
  )
}
