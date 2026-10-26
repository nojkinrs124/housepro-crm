/**
 * IndexNow: прямое уведомление Яндекса и Bing об изменившейся странице сайта,
 * без ожидания очередного обхода робота (может занимать дни даже после
 * ручного запроса в Вебмастере/Search Console).
 *
 * Ключ — просто подтверждение владения сайтом: файл с его значением лежит
 * в /public и доступен по прямому пути (whitelisted в middleware.ts, иначе
 * вся CRM отдала бы его за /login). Google этот протокол не поддерживает —
 * для него действует Indexing API (см. docs/SEO.md), IndexNow сюда не шлём.
 *
 * Не критичный путь: сетевой сбой здесь не должен ронять сохранение объекта,
 * поэтому ошибки только логируются.
 */
const INDEXNOW_KEY = 'uf2hoQ2Trngxz5Lc2AGduMtMaUZaR15D'
const SITE_HOST = 'housepro24.ru'

export function notifyIndexNow(paths: string[]): void {
  const urlList = paths.map(p => `https://${SITE_HOST}${p}`)
  fetch('https://yandex.com/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: SITE_HOST,
      key: INDEXNOW_KEY,
      keyLocation: `https://${SITE_HOST}/${INDEXNOW_KEY}.txt`,
      urlList,
    }),
  }).catch(err => {
    console.error('[indexnow] уведомление не отправлено:', err)
  })
}
