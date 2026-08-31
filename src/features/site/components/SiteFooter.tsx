import Link from 'next/link'
import { Phone, Mail, MapPin } from 'lucide-react'
import { SITE_BRAND, SITE_NAV, WORKING_HOURS } from '@/features/site/config'

interface Props {
  phone: string
  phoneHref: string
  email: string
  address: string
  legalName: string | null
  inn: string | null
}

export function SiteFooter({ phone, phoneHref, email, address, legalName, inn }: Props) {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t mt-20" style={{ borderColor: 'var(--hp-border)', background: 'var(--hp-surface)' }}>
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          <div className="min-w-0">
            <p
              className="text-[19px] font-bold tracking-tight"
              style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: 'var(--hp-ink)' }}
            >
              {SITE_BRAND}
            </p>
            <p className="mt-2 text-[13px] leading-relaxed" style={{ color: 'var(--hp-sub)' }}>
              Аренда, продажа и доверительное управление жильём в Красноярске и Берёзовке.
              Работаем по договору, отвечаем за юридическую часть сделки.
            </p>
          </div>

          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.09em]" style={{ color: 'var(--hp-sub)' }}>
              Разделы
            </p>
            <ul className="mt-3 space-y-2">
              {SITE_NAV.map(item => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-[13.5px] font-medium transition-colors hover:opacity-70"
                    style={{ color: 'var(--hp-ink)' }}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.09em]" style={{ color: 'var(--hp-sub)' }}>
              Связаться
            </p>
            <ul className="mt-3 space-y-2.5 text-[13.5px]" style={{ color: 'var(--hp-ink)' }}>
              <li className="flex items-start gap-2">
                <Phone style={{ width: 14, height: 14, marginTop: 3, flexShrink: 0, color: 'var(--hp-accent)' }} />
                <a href={phoneHref} className="font-semibold hover:opacity-70 transition-opacity break-words">
                  {phone}
                </a>
              </li>
              <li className="flex items-start gap-2">
                <Mail style={{ width: 14, height: 14, marginTop: 3, flexShrink: 0, color: 'var(--hp-accent)' }} />
                <a href={`mailto:${email}`} className="hover:opacity-70 transition-opacity break-all">
                  {email}
                </a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin style={{ width: 14, height: 14, marginTop: 3, flexShrink: 0, color: 'var(--hp-accent)' }} />
                <span className="break-words" style={{ color: 'var(--hp-sub)' }}>{address}</span>
              </li>
            </ul>
          </div>

          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.09em]" style={{ color: 'var(--hp-sub)' }}>
              Реквизиты
            </p>
            <div className="mt-3 space-y-1.5 text-[13px]" style={{ color: 'var(--hp-sub)' }}>
              {legalName && <p className="break-words">{legalName}</p>}
              {inn && <p>ИНН {inn}</p>}
              <p>{WORKING_HOURS}</p>
            </div>
          </div>
        </div>

        <div
          className="mt-10 pt-6 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-[12.5px]"
          style={{ borderColor: 'var(--hp-border-soft)', color: 'var(--hp-tertiary)' }}
        >
          <p>© {year} {SITE_BRAND}</p>
          <p className="max-w-[520px] sm:text-right">
            Информация на сайте не является публичной офертой. Актуальность и условия
            по объекту уточняйте у агента.
          </p>
        </div>
      </div>
    </footer>
  )
}
