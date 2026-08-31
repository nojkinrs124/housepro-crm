import type { Metadata } from 'next'
import { Clock, Mail, MapPin, Phone } from 'lucide-react'
import { LeadForm } from '@/features/site/components/LeadForm'
import { getSiteContacts } from '@/features/site/lib/contacts'
import { WORKING_HOURS } from '@/features/site/config'

export const metadata: Metadata = {
  title: 'Контакты — ХаусПро, агентство недвижимости в Красноярске',
  description:
    'Телефон, почта и адрес агентства недвижимости ХаусПро. Оставьте заявку на подбор квартиры, сдачу своего объекта или консультацию — агент перезвонит в рабочее время.',
}

export default async function ContactsPage() {
  const contacts = await getSiteContacts()

  const cards = [
    {
      Icon: Phone,
      label: 'Телефон',
      value: contacts.phone,
      href: contacts.phoneHref,
      note: 'Звонок и мессенджеры на этом же номере',
    },
    {
      Icon: Mail,
      label: 'Почта',
      value: contacts.email,
      href: `mailto:${contacts.email}`,
      note: 'Отвечаем в течение рабочего дня',
    },
    {
      Icon: MapPin,
      label: 'Адрес',
      value: contacts.address,
      href: null,
      note: 'Встречи по предварительной договорённости',
    },
    {
      Icon: Clock,
      label: 'Часы работы',
      value: WORKING_HOURS,
      href: null,
      note: 'Показы возможны и в другое время по согласованию',
    },
  ]

  return (
    <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <header className="max-w-[720px]">
        <h1
          className="text-[30px] sm:text-[40px] font-bold tracking-tight leading-tight"
          style={{ color: 'var(--hp-ink)' }}
        >
          Контакты
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed" style={{ color: 'var(--hp-sub)' }}>
          Позвоните или напишите — агент уточнит детали и предложит время показа.
          Заявка с формы попадает напрямую в работу, минуя колл-центр.
        </p>
      </header>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ Icon, label, value, href, note }) => (
          <div
            key={label}
            className="p-5 border h-full flex flex-col"
            style={{
              background: 'var(--hp-surface)',
              borderColor: 'var(--hp-border)',
              borderRadius: 'var(--hp-radius)',
            }}
          >
            <div
              className="w-10 h-10 flex items-center justify-center shrink-0 border"
              style={{
                background: 'var(--hp-neutral-tint)',
                borderColor: 'var(--hp-border)',
                borderRadius: 'var(--hp-radius)',
              }}
            >
              <Icon style={{ width: 17, height: 17, color: 'var(--hp-ink)' }} />
            </div>
            <p
              className="mt-4 text-[10px] font-semibold uppercase tracking-[0.09em]"
              style={{ color: 'var(--hp-sub)' }}
            >
              {label}
            </p>
            {href ? (
              <a
                href={href}
                className="mt-1.5 text-[15px] font-bold break-words transition-opacity hover:opacity-70"
                style={{ color: 'var(--hp-ink)' }}
              >
                {value}
              </a>
            ) : (
              <p className="mt-1.5 text-[15px] font-bold break-words" style={{ color: 'var(--hp-ink)' }}>
                {value}
              </p>
            )}
            <p className="mt-auto pt-3 text-[12.5px] leading-snug" style={{ color: 'var(--hp-tertiary)' }}>
              {note}
            </p>
          </div>
        ))}
      </div>

      <section
        className="mt-6 border p-5 sm:p-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-8"
        style={{
          background: 'var(--hp-surface)',
          borderColor: 'var(--hp-border)',
          borderRadius: 'var(--hp-radius)',
        }}
      >
        <div className="min-w-0">
          <h2 className="text-[22px] sm:text-[26px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
            Оставить заявку
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed" style={{ color: 'var(--hp-sub)' }}>
            Напишите, что нужно: снять, сдать, купить, продать или просто проверить
            документы по объекту, который вы уже нашли. Чем конкретнее запрос —
            бюджет, район, сроки — тем точнее будет первый же звонок.
          </p>

          {contacts.legalName && (
            <div className="hp-block mt-6">
              <div className="hp-block-header">Исполнитель по договору</div>
              <div className="hp-block-row">
                <span className="label">Наименование</span>
                <span className="value break-words">{contacts.legalName}</span>
              </div>
              {contacts.inn && (
                <div className="hp-block-row">
                  <span className="label">ИНН</span>
                  <span className="value">{contacts.inn}</span>
                </div>
              )}
              {contacts.ogrn && (
                <div className="hp-block-row">
                  <span className="label">ОГРНИП</span>
                  <span className="value">{contacts.ogrn}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="min-w-0">
          <LeadForm submitLabel="Отправить заявку" />
        </div>
      </section>
    </div>
  )
}
