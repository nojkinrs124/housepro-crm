// Общий helper для абсолютного URL сайта из Telegram-модулей бота (deep-линки в CRM,
// картинки/документы, отправляемые пользователю). Логика идентична приватным siteUrl()/
// apiBase() в channel-links.ts / channel.ts / tools.ts / api/telegram/setup — не сведено
// в одну точку ради них (риск регрессии не оправдан), но НОВЫЙ код в этом модуле должен
// использовать этот файл, а не заводить ещё одну копию.
export function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null) ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  )
}
