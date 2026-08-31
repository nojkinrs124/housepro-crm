import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ClipboardList, FileText, ShieldCheck, Wallet } from 'lucide-react'
import { CatalogFilters } from '@/features/site/components/CatalogFilters'
import { LeadForm } from '@/features/site/components/LeadForm'
import { PropertyCard } from '@/features/site/components/PropertyCard'
import { fetchFeaturedProperties, fetchPublishedDistricts } from '@/features/site/lib/properties'
import { getSiteContacts } from '@/features/site/lib/contacts'
import { SITE_BRAND } from '@/features/site/config'

export const metadata: Metadata = {
  title: 'ХаусПро — аренда и продажа квартир в Красноярске',
  description:
    'Агентство недвижимости ХаусПро: аренда, продажа и доверительное управление жильём в Красноярске. Проверяем документы собственника, готовим договор под объект, фиксируем состояние в акте.',
}

const WORK_STEPS = [
  {
    Icon: ShieldCheck,
    title: 'Проверяем документы до показа',
    text: 'Выписка из ЕГРН, основание права собственности, согласие супруга, отсутствие обременений и прописанных третьих лиц. Если с документами что-то не так — вы узнаёте об этом до внесения залога, а не после.',
  },
  {
    Icon: FileText,
    title: 'Договор пишем под конкретный объект',
    text: 'Не скачанный шаблон: срок, порядок и дата оплаты, кто платит за коммуналку, что считается мелким ремонтом, условия досрочного расторжения и возврата залога — всё под ваш случай.',
  },
  {
    Icon: ClipboardList,
    title: 'Акт приёма-передачи с описью',
    text: 'Показания счётчиков, мебель, техника, состояние отделки — на бумаге и с фото. Это то, из-за отсутствия чего чаще всего теряют залог при выезде.',
  },
  {
    Icon: Wallet,
    title: 'Комиссия названа до начала работы',
    text: 'Размер комиссии и момент оплаты фиксируются в договоре с агентством. Никаких «доплат за оформление» в день подписания.',
  },
]

export default async function HomePage() {
  const [featured, districts, contacts] = await Promise.all([
    fetchFeaturedProperties(6),
    fetchPublishedDistricts(),
    getSiteContacts(),
  ])

  return (
    <>
      {/* ── Хиро ─────────────────────────────────────────────────────── */}
      <section className="max-w-[1180px] mx-auto px-4 sm:px-6 pt-14 pb-12 sm:pt-20 sm:pb-16">
        <div className="max-w-[760px]">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: 'var(--hp-sub)' }}
          >
            {SITE_BRAND} · Красноярск и Берёзовка
          </p>
          <h1
            className="mt-4 text-[34px] sm:text-[46px] lg:text-[54px] font-bold leading-[1.06] tracking-tight break-words"
            style={{ color: 'var(--hp-ink)' }}
          >
            Снять, сдать или продать квартиру — с договором, который защищает
          </h1>
          <p
            className="mt-5 text-[16px] sm:text-[18px] leading-relaxed max-w-[640px]"
            style={{ color: 'var(--hp-sub)' }}
          >
            Мы ведём сделку целиком: проверяем документы собственника, показываем объект,
            составляем договор под конкретную квартиру и передаём ключи по акту с описью.
            Комиссию называем до начала работы.
          </p>

          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <Link href="/catalog" className="hp-btn-primary h-11 justify-center">
              Смотреть объекты
              <ArrowRight style={{ width: 15, height: 15 }} />
            </Link>
            <a href={contacts.phoneHref} className="hp-btn-secondary h-11 justify-center">
              Позвонить {contacts.phone}
            </a>
          </div>
        </div>
      </section>

      {/* ── Быстрый подбор ───────────────────────────────────────────── */}
      <section className="max-w-[1180px] mx-auto px-4 sm:px-6">
        <h2 className="text-[22px] sm:text-[26px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
          Подобрать объект
        </h2>
        <p className="mt-1.5 mb-4 text-[14px]" style={{ color: 'var(--hp-sub)' }}>
          Задайте параметры — покажем то, что действительно свободно сейчас
        </p>
        <CatalogFilters filters={{}} districts={districts} compact />
      </section>

      {/* ── Подборка объектов ────────────────────────────────────────── */}
      <section className="max-w-[1180px] mx-auto px-4 sm:px-6 pt-16">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h2 className="text-[22px] sm:text-[26px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
              Свободные объекты
            </h2>
            <p className="mt-1.5 text-[14px]" style={{ color: 'var(--hp-sub)' }}>
              Актуальность проверяется агентом перед каждым показом
            </p>
          </div>
          <Link
            href="/catalog"
            className="text-[13.5px] font-semibold inline-flex items-center gap-1.5 shrink-0 transition-opacity hover:opacity-70"
            style={{ color: 'var(--hp-accent)' }}
          >
            Весь каталог
            <ArrowRight style={{ width: 14, height: 14 }} />
          </Link>
        </div>

        {featured.length === 0 ? (
          <div
            className="mt-5 border text-center px-6 py-14"
            style={{
              background: 'var(--hp-surface)',
              borderColor: 'var(--hp-border)',
              borderRadius: 'var(--hp-radius)',
            }}
          >
            <p className="text-[16px] font-bold" style={{ color: 'var(--hp-ink)' }}>
              Сейчас в открытой публикации нет объектов
            </p>
            <p className="mt-2 text-[14px] max-w-[520px] mx-auto leading-relaxed" style={{ color: 'var(--hp-sub)' }}>
              Часть квартир мы не выкладываем в открытый доступ по просьбе собственников.
              Опишите, что ищете — агент подберёт варианты из закрытой базы.
            </p>
            <a href="#zayavka" className="hp-btn-primary h-11 mt-5">
              Оставить заявку на подбор
            </a>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featured.map(property => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        )}
      </section>

      {/* ── Что входит в работу ──────────────────────────────────────── */}
      <section className="max-w-[1180px] mx-auto px-4 sm:px-6 pt-20">
        <h2 className="text-[22px] sm:text-[26px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
          Что входит в работу агентства
        </h2>
        <p className="mt-1.5 mb-5 text-[14px] max-w-[620px]" style={{ color: 'var(--hp-sub)' }}>
          Четыре вещи, из-за отсутствия которых чаще всего возникают споры между
          собственником и нанимателем
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {WORK_STEPS.map(({ Icon, title, text }) => (
            <div
              key={title}
              className="p-5 border h-full flex flex-col"
              style={{
                background: 'var(--hp-surface)',
                borderColor: 'var(--hp-border)',
                borderRadius: 'var(--hp-radius)',
              }}
            >
              <div
                className="w-11 h-11 flex items-center justify-center shrink-0 border"
                style={{
                  background: 'var(--hp-neutral-tint)',
                  borderColor: 'var(--hp-border)',
                  borderRadius: 'var(--hp-radius)',
                }}
              >
                <Icon style={{ width: 19, height: 19, color: 'var(--hp-ink)' }} />
              </div>
              <h3 className="mt-4 text-[16px] font-bold leading-snug" style={{ color: 'var(--hp-ink)' }}>
                {title}
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed" style={{ color: 'var(--hp-sub)' }}>
                {text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Заявка ───────────────────────────────────────────────────── */}
      <section id="zayavka" className="max-w-[1180px] mx-auto px-4 sm:px-6 pt-20 scroll-mt-20">
        <div
          className="border p-5 sm:p-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-8"
          style={{
            background: 'var(--hp-surface)',
            borderColor: 'var(--hp-border)',
            borderRadius: 'var(--hp-radius)',
          }}
        >
          <div className="min-w-0">
            <h2 className="text-[22px] sm:text-[26px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
              Расскажите, что нужно
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed" style={{ color: 'var(--hp-sub)' }}>
              Подбор, сдача своей квартиры, проверка документов перед покупкой или
              вопрос по уже подписанному договору — напишите одной строкой,
              агент перезвонит и уточнит детали.
            </p>
            <div className="hp-block mt-5">
              <div className="hp-block-header">Как с нами связаться</div>
              <div className="hp-block-row">
                <span className="label">Телефон</span>
                <a href={contacts.phoneHref} className="value transition-opacity hover:opacity-70">
                  {contacts.phone}
                </a>
              </div>
              <div className="hp-block-row">
                <span className="label">Почта</span>
                <a href={`mailto:${contacts.email}`} className="value break-all transition-opacity hover:opacity-70">
                  {contacts.email}
                </a>
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <LeadForm />
          </div>
        </div>
      </section>
    </>
  )
}
