import { revalidatePath } from 'next/cache'
import { notifyIndexNow } from '@/features/site/lib/indexnow'

/**
 * Сбрасывает кэш публичного сайта после изменения объекта в CRM.
 *
 * Главная («Свободные объекты») и sitemap — статические, живут по таймеру;
 * без явного сброса правка цены или фото доезжала до сайта через минуту и
 * только со второго визита (stale-while-revalidate). Каталог и карточка
 * рендерятся на запрос, но `fetch` внутри кэширован на 60 с — сбрасываем
 * и их, чтобы сотрудник видел результат сразу.
 *
 * Параллельно уведомляем Яндекс/Bing через IndexNow — так новый или
 * изменённый объект попадает им на переобход за минуты, а не ждёт
 * очередного плана обхода (это может быть несколько дней).
 *
 * Только сервер: зовётся из Server Actions после записи в `properties`.
 */
export function revalidateSiteForProperty(propertyId?: string): void {
  revalidatePath('/')
  revalidatePath('/catalog')
  if (propertyId) revalidatePath(`/catalog/${propertyId}`)
  revalidatePath('/sitemap.xml')

  notifyIndexNow(['/', '/catalog', ...(propertyId ? [`/catalog/${propertyId}`] : [])])
}
