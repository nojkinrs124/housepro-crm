import { formatPhone, normalizePhone } from '@/lib/utils'
import { FALLBACK_CONTACTS } from '@/features/site/config'
import { fetchCompanyContacts } from '@/features/site/lib/properties'

export interface SiteContacts {
  /** Телефон в читаемом виде: +7 (960) 762-67-99 */
  phone: string
  /** tel:-ссылка */
  phoneHref: string
  email: string
  address: string
  /** Юридическое имя из company_settings (ИП/ООО), если заполнено */
  legalName: string | null
  inn: string | null
  ogrn: string | null
}

/**
 * Контакты для шапки/подвала/страницы контактов.
 * Данные берутся из company_settings через узкий VIEW public_company_contacts;
 * если настройки ещё не заполнены — подставляются константы из config.ts,
 * чтобы сайт никогда не показывал пустые прочерки вместо телефона.
 */
export async function getSiteContacts(): Promise<SiteContacts> {
  const company = await fetchCompanyContacts()

  const rawPhone = company?.phone?.trim() || FALLBACK_CONTACTS.phone
  const normalized = normalizePhone(rawPhone)

  return {
    phone: formatPhone(normalized ?? rawPhone),
    phoneHref: `tel:${normalized ?? rawPhone.replace(/\s/g, '')}`,
    email: company?.email?.trim() || FALLBACK_CONTACTS.email,
    address: company?.address?.trim() || FALLBACK_CONTACTS.address,
    legalName: company?.name?.trim() || null,
    inn: company?.inn?.trim() || null,
    ogrn: company?.ogrn?.trim() || null,
  }
}
