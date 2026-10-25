import Link from 'next/link'
import { Phone, Mail, MapPin } from 'lucide-react'
import { SITE_BRAND, SITE_NAV, SITE_SERVICES_NAV, SITE_SLOGAN, WORKING_HOURS } from '@/features/site/config'
import { BrandLogo } from '@/components/brand/BrandLogo'

interface Props {
  phone: string
  phoneHref: string
  email: string
  address: string
  legalName: string | null
  inn: string | null
}

/**
 * Подвал сайта — тёмный «лесной» блок бренда (brand/BRANDBOOK.md, раздел 8).
 * Латунь здесь — слоган и иконки: на лесном фоне она проходит контраст (6.3:1),
 * на светлом — нет, поэтому за пределы тёмных блоков не выносится.
 */
const label = 'text-[12px] font-semibold uppercase tracking-[0.1em]'
const link = 'text-[14px] font-medium transition-opacity hover:opacity-70'

export function SiteFooter({ phone, phoneHref, email, address, legalName, inn }: Props) {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-20" style={{ background: 'var(--hp-forest)', color: 'var(--hp-on-forest)' }}>
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10">
          <div className="min-w-0">
            <BrandLogo markSize={40} tone="dark" />
            <p
              className="mt-5 text-[19px] font-bold leading-snug"
              style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: 'var(--hp-brass)' }}
            >
              {SITE_SLOGAN}
            </p>
            <p className="mt-2 text-[16px] leading-relaxed" style={{ color: 'var(--hp-on-forest-sub)' }}>
              Частный риелтор в Красноярске и Берёзовке: управление, аренда и продажа квартир.
            </p>
          </div>

          <div className="min-w-0">
            <p className={label} style={{ color: 'var(--hp-on-forest-sub)' }}>Разделы</p>
            <ul className="mt-3 space-y-2">
              {SITE_NAV.map(item => (
                <li key={item.href}>
                  <Link href={item.href} className={link} style={{ color: 'var(--hp-on-forest)' }}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="min-w-0">
            <p className={label} style={{ color: 'var(--hp-on-forest-sub)' }}>Услуги</p>
            <ul className="mt-3 space-y-2">
              {SITE_SERVICES_NAV.map(item => (
                <li key={item.href}>
                  <Link href={item.href} className={link} style={{ color: 'var(--hp-on-forest)' }}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="min-w-0">
            <p className={label} style={{ color: 'var(--hp-on-forest-sub)' }}>Связаться</p>
            <ul className="mt-3 space-y-2.5 text-[14px]">
              <li className="flex items-start gap-2">
                <Phone style={{ width: 14, height: 14, marginTop: 4, flexShrink: 0, color: 'var(--hp-brass)' }} />
                <a href={phoneHref} className="font-semibold hover:opacity-70 transition-opacity break-words">
                  {phone}
                </a>
              </li>
              <li className="flex items-start gap-2">
                <Mail style={{ width: 14, height: 14, marginTop: 4, flexShrink: 0, color: 'var(--hp-brass)' }} />
                <a href={`mailto:${email}`} className="hover:opacity-70 transition-opacity break-all">
                  {email}
                </a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin style={{ width: 14, height: 14, marginTop: 4, flexShrink: 0, color: 'var(--hp-brass)' }} />
                <span className="break-words" style={{ color: 'var(--hp-on-forest-sub)' }}>{address}</span>
              </li>
              <li className="pl-[22px]" style={{ color: 'var(--hp-on-forest-sub)' }}>{WORKING_HOURS}</li>
            </ul>
          </div>

          <div className="min-w-0">
            <p className={label} style={{ color: 'var(--hp-on-forest-sub)' }}>Реквизиты</p>
            <div className="mt-3 space-y-1.5 text-[14px]" style={{ color: 'var(--hp-on-forest-sub)' }}>
              {legalName && <p className="break-words" style={{ color: 'var(--hp-on-forest)' }}>{legalName}</p>}
              <p>Самозанятый (НПД)</p>
              {inn && <p>ИНН {inn}</p>}
            </div>
          </div>
        </div>

        <div
          className="mt-12 pt-6 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-[14px]"
          style={{ borderColor: 'var(--hp-on-forest-line)', color: 'var(--hp-on-forest-sub)' }}
        >
          <p>© {year} {SITE_BRAND} · Руслан Ножкин</p>
          <p className="max-w-[520px] sm:text-right">
            Информация на сайте не является публичной офертой. Актуальность и условия
            по объекту уточняйте у меня по телефону.
          </p>
        </div>
      </div>
    </footer>
  )
}
