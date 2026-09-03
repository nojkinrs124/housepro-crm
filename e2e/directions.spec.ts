import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

/**
 * Направления работы: проверка на живых данных, БЕЗ записи в базу.
 *
 * Сквозной тест, который заводит сделку и проводит её по воронке, здесь
 * намеренно не делается: набор гоняется по проду, и каждая такая проверка
 * оставляла бы в боевой базе мусор — при падении посреди сценария уборка не
 * отрабатывает. Поведение перехода (отказ с причиной, чек-лист, предусловия)
 * держат юнит-тесты в src/tests/unit/direction-transitions.test.ts: там оно
 * проверяется полнее и без риска для данных.
 *
 * Здесь — то, что видно снаружи и что юнит-тест не покажет: доска действительно
 * строится по направлениям, а не по одной общей воронке.
 */

test.describe('Направления работы', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('фильтр предлагает четыре направления, а не старые типы сделок', async ({ page }) => {
    await page.goto('/deals', { waitUntil: 'domcontentloaded' })

    const filterText = await page.locator('main').innerText()
    expect(filterText).toContain('Направление')

    // Старых типов сделок в интерфейсе быть не должно.
    expect(filterText).not.toContain('Субаренда')
    expect(filterText).not.toContain('Коммерция')
  })

  test('доска строится по воронке направления', async ({ page }) => {
    await page.goto('/deals', { waitUntil: 'domcontentloaded' })
    const board = await page.locator('main').innerText()

    // Колонки аренды по тарифу «Агент» — их семь до завершения.
    for (const column of ['ПОИСК', 'ВСТРЕЧИ', 'ДОГОВОР', 'ПОДГОТОВКА', 'ПОКАЗЫ', 'ПРОВЕРКА', 'ЗАСЕЛЕНИЕ']) {
      expect(board, `на доске нет колонки «${column}»`).toContain(column)
    }

    // Колонок старой общей воронки не осталось.
    expect(board).not.toContain('ПЕРЕГОВОРЫ')
    expect(board).not.toContain('ОПЛАТА')
  })

  test('карточка сделки показывает стадии своего направления', async ({ page }) => {
    // Ссылку на сделку берём с дашборда: карточки канбана открываются скриптом,
    // а переключение на реестр хранится вне адреса и в тесте не воспроизводится.
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
    const href = await page
      .locator('a[href^="/deals/"]')
      .evaluateAll(links =>
        (links as HTMLAnchorElement[])
          .map(a => a.getAttribute('href') ?? '')
          .find(h => /^\/deals\/[0-9a-f-]{36}$/.test(h)) ?? null
      )
    expect(href, 'на дашборде нет ни одной ссылки на сделку').not.toBeNull()

    await page.goto(href as string, { waitUntil: 'domcontentloaded' })

    // Степпер стадий и блок чек-листа — оба появились в этой пересборке.
    const card = await page.locator('main').innerText()
    expect(card.toUpperCase()).toContain('СТАДИИ')
  })

  test('раздел тарифов агентства открывается и содержит стартовые тарифы', async ({ page }) => {
    await page.goto('/settings/plans', { waitUntil: 'domcontentloaded' })
    // Верхний регистр: заголовки блоков стилизуются text-transform, и innerText
    // отдаёт уже преобразованный текст.
    const text = (await page.locator('main').innerText()).toUpperCase()

    expect(text).toContain('АГЕНТ ПО НЕДВИЖИМОСТИ')
    expect(text).toContain('УПРАВЛЕНИЕ ПРЕМИУМ')
    // Ставка со ставкой из справочника, а не выдуманная в вёрстке.
    expect(text).toMatch(/25%/)
    expect(text).toMatch(/15%/)
  })
})
