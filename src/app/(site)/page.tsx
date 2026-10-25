import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ClipboardList, FileText, ShieldCheck, Wallet } from 'lucide-react'
import { CatalogFilters } from '@/features/site/components/CatalogFilters'
import { LeadForm } from '@/features/site/components/LeadForm'
import { PropertyCard } from '@/features/site/components/PropertyCard'
import { fetchFeaturedProperties, fetchPublishedDistricts } from '@/features/site/lib/properties'
import { getSiteContacts } from '@/features/site/lib/contacts'
import { TARIFFS, TRUST, USLUGI } from '@/features/site/uslugi/config'

export const metadata: Metadata = {
  title: 'Сдаю и веду вашу квартиру в Красноярске — ХаусПро, Руслан Ножкин',
  description:
    'ХаусПро — Руслан Ножкин, частный риелтор в Красноярске. Доверительное управление квартирами, сдача в аренду и продажа. Нахожу и проверяю жильцов, оформляю договор и акт с описью, раз в месяц присылаю отчёт.',
}

const WORK_STEPS = [
  {
    Icon: ShieldCheck,
    title: 'Проверяю документы до показа',
    text: 'Выписка из ЕГРН, основание права собственности, согласие супруга, отсутствие обременений и прописанных третьих лиц. Если с документами что-то не так — вы узнаёте об этом до внесения залога, а не после.',
  },
  {
    Icon: FileText,
    title: 'Договор пишу под конкретный объект',
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
    text: 'Размер комиссии и момент оплаты фиксируются в договоре со мной. Никаких «доплат за оформление» в день подписания.',
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
            className="text-[12px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: 'var(--hp-sub)' }}
          >
            Частный риелтор · Красноярск
          </p>
          <h1
            className="mt-4 text-[34px] sm:text-[46px] lg:text-[54px] font-bold leading-[1.06] tracking-tight break-words"
            style={{ color: 'var(--hp-ink)' }}
          >
            Сдаю и веду вашу квартиру в{"\u00a0"}Красноярске
          </h1>
          <p
            className="mt-5 text-[16px] sm:text-[18px] leading-relaxed max-w-[640px]"
            style={{ color: 'var(--hp-sub)' }}
          >
            Нахожу и проверяю жильцов, оформляю договор найма и акт с описью, раз в месяц
            присылаю отчёт. Подписание дистанционное — приезжать никуда не нужно.
            Комиссию называю до начала работы.
          </p>

          <div className="mt-7 flex flex-col sm:flex-row sm:flex-wrap gap-3 lg:w-[920px] lg:max-w-[calc(100vw-48px)]">
            <Link href="/uslugi/sdat-kvartiru" className="hp-btn-primary h-11 justify-center whitespace-nowrap">
              Передать квартиру в управление
              <ArrowRight style={{ width: 15, height: 15 }} />
            </Link>
            <Link href="/catalog" className="hp-btn-secondary h-11 justify-center whitespace-nowrap">
              Смотреть объекты
            </Link>
            <a href={contacts.phoneHref} className="hp-btn-secondary h-11 justify-center whitespace-nowrap">
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
          Задайте параметры — покажу то, что действительно свободно сейчас
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
              Актуальность проверяю перед каждым показом
            </p>
          </div>
          <Link
            href="/catalog"
            className="text-[14px] font-semibold inline-flex items-center gap-1.5 shrink-0 transition-opacity hover:opacity-70"
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
              Часть квартир я не выкладываю в открытый доступ по просьбе собственников.
              Опишите, что ищете — подберу варианты из закрытой базы.
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
          Что входит в мою работу
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
              <p className="mt-2 text-[16px] leading-relaxed" style={{ color: 'var(--hp-sub)' }}>
                {text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Обещание бренда — лесной блок (brand/BRANDBOOK.md, раздел 6) ── */}
      <section className="max-w-[1180px] mx-auto px-4 sm:px-6 pt-20">
        <div className="hp-forest p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-8 lg:gap-12">
          <div className="min-w-0">
            <p className="hp-eyebrow hp-forest-sub">Доверительное управление</p>
            <h2 className="mt-3 text-[28px] sm:text-[34px] font-bold leading-tight tracking-tight">
              Квартира сдана, деньги приходят, а&nbsp;вас не&nbsp;дёргают
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed hp-forest-sub max-w-[560px]">
              Беру на себя жильцов, договор, акт, платежи и бытовые вопросы. Раз в месяц присылаю
              отчёт: сколько пришло, что было с квартирой, показания счётчиков.
            </p>
            <span className="hp-sign-line mt-6" aria-hidden="true" />
            <p className="mt-3 text-[15px] font-semibold">Руслан Ножкин</p>
            <Link
              href="/uslugi/sdat-kvartiru"
              className="mt-6 inline-flex items-center gap-2 text-[15px] font-semibold hp-forest-accent transition-opacity hover:opacity-80"
            >
              Условия управления
              <ArrowRight style={{ width: 15, height: 15 }} />
            </Link>
          </div>
          <dl className="min-w-0 grid grid-cols-2 border-t hp-forest-line">
            {[
              { v: `от ${TARIFFS.upravlenie.percent}%`, l: 'в месяц за управление' },
              { v: `с ${TRUST.sinceYear}`, l: 'года в недвижимости' },
              { v: `${TRUST.closedDeals}+`, l: 'закрытых сделок' },
              { v: `${USLUGI.payoutWindow.fromDay}–${USLUGI.payoutWindow.toDay}`, l: 'числа — деньги у вас на карте' },
            ].map((s, i) => (
              <div
                key={s.l}
                className={`py-6 border-b hp-forest-line flex flex-col justify-center ${i % 2 === 0 ? 'pr-4 border-r' : 'pl-5'}`}
              >
                <dt className="hp-price text-[30px] sm:text-[34px] leading-none hp-forest-accent">{s.v}</dt>
                <dd className="mt-2 text-[14px] hp-forest-sub">{s.l}</dd>
              </div>
            ))}
          </dl>
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
            <p className="mt-3 text-[16px] leading-relaxed" style={{ color: 'var(--hp-sub)' }}>
              Подбор, сдача своей квартиры, проверка документов перед покупкой или
              вопрос по уже подписанному договору — напишите одной строкой,
              перезвоню и уточню детали.
            </p>
            <div className="hp-block mt-5">
              <div className="hp-block-header">Контакты</div>
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
