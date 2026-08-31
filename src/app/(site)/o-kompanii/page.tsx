import type { Metadata } from 'next'
import Link from 'next/link'
import { getSiteContacts } from '@/features/site/lib/contacts'
import { SITE_BRAND } from '@/features/site/config'

export const metadata: Metadata = {
  title: 'О компании — агентство недвижимости ХаусПро',
  description:
    'ХаусПро — агентство недвижимости в Красноярске и Берёзовке: аренда, продажа и доверительное управление жильём. Как мы работаем, за что отвечаем и на каких условиях.',
}

const PRINCIPLES = [
  {
    title: 'Работаем по договору с самого начала',
    text:
      'Устная договорённость «покажем — потом решим» не даёт вам никаких прав. Мы подписываем договор с агентством до начала работы: в нём написано, что мы делаем, в какой срок и сколько это стоит.',
  },
  {
    title: 'Не берём объект, документы которого не сходятся',
    text:
      'Если собственник не может показать основание права, есть непогашенное обременение или не получено согласие второго супруга — мы не выводим объект на показы. Это стоит нам сделок, но избавляет клиентов от расторжений.',
  },
  {
    title: 'Один агент ведёт сделку до конца',
    text:
      'Вас не передают между сотрудниками. Тот, кто провёл первый показ, доводит дело до подписания акта и остаётся на связи после — по вопросам продления, ремонта и возврата залога.',
  },
  {
    title: 'Говорим о рисках прямо',
    text:
      'Если квартира дешевле рынка — объясняем, почему. Если условия договора невыгодны вам — говорим об этом, даже когда сделка уже почти состоялась.',
  },
]

const FAQ = [
  {
    q: 'Сколько стоит ваша работа?',
    a: 'Зависит от услуги. При сдаче квартиры комиссию платит наниматель — собственник не платит ничего. При подборе жилья и сопровождении сделки размер комиссии называется до начала работы и фиксируется в договоре. Доплат «за оформление документов» в день подписания у нас нет.',
  },
  {
    q: 'Почему в каталоге мало объектов?',
    a: 'В открытую публикацию попадают только те объекты, которые собственник разрешил показывать публично. Значительная часть базы закрыта по просьбе владельцев. Оставьте заявку с параметрами — агент подберёт варианты из закрытой части.',
  },
  {
    q: 'Что вы проверяете перед сделкой?',
    a: 'Выписку из ЕГРН, основание права собственности, наличие обременений и арестов, зарегистрированных в квартире лиц, согласие супруга при совместной собственности, полномочия представителя, если собственник действует по доверенности.',
  },
  {
    q: 'Что делать, если после заезда что-то сломалось?',
    a: 'В договоре и акте разделено, что относится к естественному износу и обязанностям собственника, а что — к ответственности нанимателя. Если спор всё же возник, агент, который вёл сделку, разбирает ситуацию с обеими сторонами.',
  },
]

export default async function AboutPage() {
  const contacts = await getSiteContacts()

  return (
    <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <header className="max-w-[760px]">
        <h1
          className="text-[30px] sm:text-[40px] font-bold tracking-tight leading-tight"
          style={{ color: 'var(--hp-ink)' }}
        >
          О компании
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed" style={{ color: 'var(--hp-sub)' }}>
          {SITE_BRAND} — агентство недвижимости, которое работает с жилой и коммерческой
          недвижимостью в Красноярске и Берёзовке. Основное направление — аренда: сдача
          квартир собственников и подбор жилья нанимателям. Помимо этого ведём сделки
          купли-продажи и берём объекты в доверительное управление.
        </p>
      </header>

      {/* ── Принципы ─────────────────────────────────────────────────── */}
      <section className="mt-10">
        <h2 className="text-[22px] sm:text-[26px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
          Как мы работаем
        </h2>
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PRINCIPLES.map(({ title, text }) => (
            <div
              key={title}
              className="p-5 border h-full flex flex-col"
              style={{
                background: 'var(--hp-surface)',
                borderColor: 'var(--hp-border)',
                borderRadius: 'var(--hp-radius)',
              }}
            >
              <h3 className="text-[16px] font-bold leading-snug" style={{ color: 'var(--hp-ink)' }}>
                {title}
              </h3>
              <p className="mt-2.5 text-[14px] leading-relaxed" style={{ color: 'var(--hp-sub)' }}>
                {text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Частые вопросы ───────────────────────────────────────────── */}
      <section className="mt-14">
        <h2 className="text-[22px] sm:text-[26px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
          Частые вопросы
        </h2>
        <div
          className="mt-5 border divide-y"
          style={{
            background: 'var(--hp-surface)',
            borderColor: 'var(--hp-border)',
            borderRadius: 'var(--hp-radius)',
          }}
        >
          {FAQ.map(({ q, a }) => (
            <details key={q} className="group px-5 py-4" style={{ borderColor: 'var(--hp-border-soft)' }}>
              <summary
                className="cursor-pointer list-none text-[15.5px] font-bold flex items-start justify-between gap-4"
                style={{ color: 'var(--hp-ink)' }}
              >
                <span className="break-words">{q}</span>
                <span
                  className="shrink-0 text-[18px] leading-none mt-0.5 transition-transform group-open:rotate-45"
                  style={{ color: 'var(--hp-tertiary)' }}
                  aria-hidden="true"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-[14px] leading-relaxed" style={{ color: 'var(--hp-sub)' }}>
                {a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* ── Реквизиты ────────────────────────────────────────────────── */}
      <section className="mt-14 grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="hp-block">
          <div className="hp-block-header">Реквизиты и контакты</div>
          {contacts.legalName && (
            <div className="hp-block-row">
              <span className="label">Исполнитель</span>
              <span className="value break-words">{contacts.legalName}</span>
            </div>
          )}
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
          <div className="hp-block-row">
            <span className="label">Адрес</span>
            <span className="value break-words">{contacts.address}</span>
          </div>
        </div>

        <div
          className="border p-5 sm:p-7"
          style={{
            background: 'var(--hp-surface)',
            borderColor: 'var(--hp-border)',
            borderRadius: 'var(--hp-radius)',
          }}
        >
          <h2 className="text-[20px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
            С чего начать
          </h2>
          <p className="mt-3 text-[14.5px] leading-relaxed" style={{ color: 'var(--hp-sub)' }}>
            Посмотрите, что сейчас свободно, или сразу напишите нам — если подходящего
            объекта нет в открытом каталоге, агент проверит закрытую базу.
          </p>
          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <Link href="/catalog" className="hp-btn-primary h-11 justify-center">
              Смотреть объекты
            </Link>
            <Link href="/kontakty" className="hp-btn-secondary h-11 justify-center">
              Написать нам
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
