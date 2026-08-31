/**
 * Константы публичного сайта «ХаусПро».
 *
 * Бренд в видимых текстах — кириллицей («ХаусПро»); в коде, схемах БД и
 * названиях пакетов продукт по-прежнему HousePro — это не переименование.
 */

export const SITE_BRAND = 'ХаусПро'
export const SITE_TAGLINE = 'Агентство недвижимости в Красноярске'

/** Запасные контакты, если company_settings ещё не заполнены. */
export const FALLBACK_CONTACTS = {
  phone: '+7 960 762-67-99',
  email: 'housepro24@yandex.ru',
  address: 'Красноярский край, пгт. Берёзовка, ул. Заводская, 103',
} as const

export const SITE_NAV: { href: string; label: string }[] = [
  { href: '/catalog', label: 'Объекты' },
  { href: '/uslugi', label: 'Услуги' },
  { href: '/o-kompanii', label: 'О компании' },
  { href: '/kontakty', label: 'Контакты' },
]

export const WORKING_HOURS = 'Пн–Сб, 9:00–20:00'
