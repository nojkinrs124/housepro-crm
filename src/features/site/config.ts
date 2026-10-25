/**
 * Константы публичного сайта «ХаусПро».
 *
 * Бренд в видимых текстах — кириллицей («ХаусПро»); в коде, схемах БД и
 * названиях пакетов продукт по-прежнему HousePro — это не переименование.
 */

export const SITE_BRAND = 'ХаусПро'
export const SITE_TAGLINE = 'Частный риелтор в Красноярске'

/** Основной слоган бренда (brand/BRANDBOOK.md v2, утверждён 25.10.2026) */
export const SITE_SLOGAN = 'Сдаю и веду вашу квартиру'

/** Запасные контакты, если company_settings ещё не заполнены. */
export const FALLBACK_CONTACTS = {
  // Город по умолчанию для фидов площадок: они требуют locality-name,
  // а из адреса объекта он вытаскивается не всегда.
  city: 'Красноярск',
  phone: '+7 960 762-67-99',
  email: 'housepro24@yandex.ru',
  address: 'Красноярский край, пгт. Берёзовка, ул. Заводская, 103',
} as const

export const SITE_NAV: { href: string; label: string }[] = [
  { href: '/catalog', label: 'Объекты' },
  { href: '/uslugi', label: 'Услуги' },
  { href: '/o-kompanii', label: 'Обо мне' },
  { href: '/kontakty', label: 'Контакты' },
]

/** Страницы раздела «Услуги» — в подвале отдельной колонкой, в шапке только хаб. */
export const SITE_SERVICES_NAV: { href: string; label: string }[] = [
  { href: '/uslugi/sdat-kvartiru', label: 'Сдать квартиру' },
  { href: '/uslugi/snyat-kvartiru', label: 'Снять квартиру' },
  { href: '/uslugi/prodat-kupit', label: 'Продать или купить' },
]

export const WORKING_HOURS = 'Пн–Сб, 9:00–20:00'
