import { env } from '@/lib/env'
import { SITE_BRAND, WORKING_HOURS } from '@/features/site/config'
import type { SiteContacts } from '@/features/site/lib/contacts'

/**
 * Разметка Schema.org для публичного сайта.
 *
 * Нужна поисковикам, а не людям: Google строит из неё панель организации,
 * Яндекс — расширенный сниппет с телефоном и адресом. Данные берутся из тех же
 * контактов, что видит посетитель (company_settings → getSiteContacts), чтобы
 * разметка не расходилась с текстом страницы — за расхождение Яндекс снижает
 * доверие к сниппету.
 *
 * Тип RealEstateAgent, а не Organization: услуга — риелторская, и он даёт
 * поисковикам больше контекста. Юрлицо не выдумывается — legalName
 * подставляется только если заполнен в CRM.
 */
export function SiteJsonLd({ contacts }: { contacts: SiteContacts }) {
  const base = env.siteUrl.replace(/\/$/, '')

  const data = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    '@id': `${base}/#org`,
    name: SITE_BRAND,
    url: base,
    image: `${base}/icon-512.png`,
    logo: `${base}/icon-512.png`,
    telephone: contacts.phone,
    email: contacts.email,
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'RU',
      addressLocality: 'Красноярск',
      streetAddress: contacts.address,
    },
    areaServed: { '@type': 'City', name: 'Красноярск' },
    openingHours: WORKING_HOURS,
    founder: { '@type': 'Person', name: 'Руслан Ножкин' },
    ...(contacts.legalName ? { legalName: contacts.legalName } : {}),
    ...(contacts.inn ? { taxID: contacts.inn } : {}),
  }

  return (
    <script
      type="application/ld+json"
      // Данные свои, из БД; строка не содержит пользовательского HTML.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
