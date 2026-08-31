import type { Metadata } from 'next'
import Link from 'next/link'
import { Building2, Handshake, KeyRound, Search, ShieldCheck } from 'lucide-react'
import { LeadForm } from '@/features/site/components/LeadForm'

export const metadata: Metadata = {
  title: 'Услуги агентства — ХаусПро, Красноярск',
  description:
    'Сдача квартиры в аренду, подбор жилья для нанимателя, продажа, доверительное управление и юридическое сопровождение сделки в Красноярске. Что входит в каждую услугу и сколько это стоит.',
}

interface Service {
  Icon: typeof KeyRound
  slug: string
  title: string
  lead: string
  includes: string[]
  price: string
}

const SERVICES: Service[] = [
  {
    Icon: KeyRound,
    slug: 'sdat',
    title: 'Сдать квартиру в аренду',
    lead:
      'Вы отдаёте ключи и документы — дальше показы, отбор нанимателя и оформление на нас. Собственник участвует один раз: на подписании.',
    includes: [
      'Оценка ставки по реальным сделкам в вашем доме и районе, а не по объявлениям',
      'Фотосъёмка, текст объявления и размещение на площадках',
      'Показы без вашего участия, отсев нанимателей до просмотра',
      'Проверка нанимателя: паспорт, место работы, история прошлых аренд',
      'Договор найма под ваш объект и акт приёма-передачи с описью имущества',
    ],
    price: 'Комиссия удерживается с нанимателя. Собственник не платит за сдачу.',
  },
  {
    Icon: Search,
    slug: 'snyat',
    title: 'Снять квартиру',
    lead:
      'Подбор под ваш бюджет и район, включая объекты, которых нет в открытом доступе — часть собственников просит не публиковать адрес.',
    includes: [
      'Разбор запроса: бюджет с учётом коммуналки, сроки заезда, животные, дети, техника',
      'Отбор вариантов и организация показов подряд, а не по одному в день',
      'Проверка документов собственника до внесения залога',
      'Разбор договора: что подписываете, за что отвечаете, как возвращается залог',
      'Фиксация счётчиков и состояния квартиры при заезде',
    ],
    price: 'Комиссия обсуждается до начала подбора и фиксируется в договоре.',
  },
  {
    Icon: Handshake,
    slug: 'prodazha',
    title: 'Продажа и покупка',
    lead:
      'Сопровождение сделки купли-продажи: от оценки и предпродажной подготовки до регистрации перехода права.',
    includes: [
      'Оценка на основе состоявшихся сделок, а не запрашиваемых цен',
      'Проверка юридической чистоты: ЕГРН, история переходов права, обременения, дееспособность',
      'Организация задатка и безопасных расчётов (аккредитив или ячейка)',
      'Подготовка договора и подача документов на регистрацию',
      'Передача объекта по акту и закрытие расчётов',
    ],
    price: 'Стоимость зависит от объекта и объёма работ, называется до подписания договора.',
  },
  {
    Icon: Building2,
    slug: 'upravlenie',
    title: 'Доверительное управление',
    lead:
      'Для собственников, которые живут в другом городе или не хотят заниматься арендой сами. Мы ведём объект круглый год.',
    includes: [
      'Поиск и смена нанимателей без простоев между договорами',
      'Контроль поступления платежей и работа с просрочкой',
      'Приём показаний счётчиков, оплата коммунальных услуг',
      'Выезд на объект при аварии, организация мелкого ремонта',
      'Отчёт собственнику по поступлениям и расходам',
    ],
    price: 'Ежемесячный процент от арендной платы, зафиксирован в договоре управления.',
  },
  {
    Icon: ShieldCheck,
    slug: 'soprovozhdenie',
    title: 'Юридическое сопровождение отдельной сделки',
    lead:
      'Если объект вы нашли сами, но не хотите подписывать документы вслепую — берём на себя только правовую часть.',
    includes: [
      'Проверка документов собственника и истории объекта',
      'Составление или разбор договора под вашу ситуацию',
      'Присутствие на подписании и передаче денег',
      'Акт приёма-передачи с описью и фотофиксацией',
    ],
    price: 'Фиксированная стоимость за сделку, известна заранее.',
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
          Услуги
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed" style={{ color: 'var(--hp-sub)' }}>
          Каждая услуга — это перечень конкретных действий, который мы фиксируем в договоре
          с вами. Ниже написано, что именно входит и за что вы платите.
        </p>
      </header>

      <div className="mt-8 space-y-4">
        {SERVICES.map(({ Icon, slug, title, lead, includes, price }) => (
          <section
            key={slug}
            id={slug}
            className="border p-5 sm:p-7 scroll-mt-20"
            style={{
              background: 'var(--hp-surface)',
              borderColor: 'var(--hp-border)',
              borderRadius: 'var(--hp-radius)',
            }}
          >
            <div className="flex items-start gap-4 min-w-0">
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
              <div className="min-w-0">
                <h2 className="text-[20px] sm:text-[23px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
                  {title}
                </h2>
                <p className="mt-2 text-[15px] leading-relaxed max-w-[720px]" style={{ color: 'var(--hp-sub)' }}>
                  {lead}
                </p>
              </div>
            </div>

            <ul className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-x-8">
              {includes.map(item => (
                <li
                  key={item}
                  className="flex items-start gap-3 py-2.5 border-t text-[14px] leading-relaxed"
                  style={{ borderColor: 'var(--hp-border-soft)', color: 'var(--hp-ink)' }}
                >
                  <span
                    className="w-1.5 h-1.5 mt-2 shrink-0"
                    style={{ background: 'var(--hp-accent)' }}
                    aria-hidden="true"
                  />
                  <span className="break-words">{item}</span>
                </li>
              ))}
            </ul>

            <p
              className="mt-5 px-4 py-3 text-[13.5px] leading-relaxed border"
              style={{
                background: 'var(--hp-neutral-tint)',
                borderColor: 'var(--hp-border)',
                color: 'var(--hp-ink)',
                borderRadius: 'var(--hp-radius)',
              }}
            >
              <strong className="font-semibold">Стоимость. </strong>
              {price}
            </p>
          </section>
        ))}
      </div>

      <section
        className="mt-10 border p-5 sm:p-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-8"
        style={{
          background: 'var(--hp-surface)',
          borderColor: 'var(--hp-border)',
          borderRadius: 'var(--hp-radius)',
        }}
      >
        <div className="min-w-0">
          <h2 className="text-[22px] sm:text-[26px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
            Не знаете, какая услуга нужна?
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed" style={{ color: 'var(--hp-sub)' }}>
            Опишите ситуацию своими словами — агент скажет, что именно потребуется
            и сколько это будет стоить. Консультация до заключения договора бесплатная.
          </p>
          <Link
            href="/catalog"
            className="hp-btn-secondary h-11 mt-5"
          >
            Сначала посмотреть объекты
          </Link>
        </div>
        <div className="min-w-0">
          <LeadForm submitLabel="Получить консультацию" />
        </div>
      </section>
    </div>
  )
}
