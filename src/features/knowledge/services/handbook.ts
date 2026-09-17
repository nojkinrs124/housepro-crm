import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

/**
 * Стандартный справочник сотрудника — главы `docs/handbook/*.md`, которые
 * поставляются вместе с приложением. Новая организация получает базу знаний
 * не пустой, а с инструкциями по каждому разделу (сквозной проход 17.09.2026,
 * NAV-5: «Инструкций пока нет» при 16 готовых главах в репозитории).
 *
 * Логика — та же, что у `scripts/seed-handbook.mjs` (посев с машины разработчика):
 * slug по транслиту имени файла, заголовок — первая `# строка`, отпечаток
 * файла в `source_hash`, чтобы не затирать правки, сделанные в CRM.
 *
 * Файл без 'use client' и без 'use server': читает диск, вызывается из экшена.
 * Каталог попадает в serverless-бандл через `outputFileTracingIncludes`.
 */

const CATEGORY: Record<string, string> = {
  '00-обзор.md': 'Общее',
  '01-лиды.md': 'Продажи',
  '02-сделки.md': 'Продажи',
  '03-контакты.md': 'Продажи',
  '04-объекты.md': 'База объектов',
  '05-показы.md': 'База объектов',
  '06-подборки.md': 'База объектов',
  '07-договоры.md': 'Документы',
  '08-управление.md': 'База объектов',
  '09-задачи-и-календарь.md': 'Общее',
  '10-бухгалтерия.md': 'Деньги',
  '11-аналитика.md': 'Деньги',
  '12-сотрудники-и-права.md': 'Администрирование',
  '13-настройки.md': 'Администрирование',
  '14-телеграм-бот.md': 'Общее',
  '15-база-знаний.md': 'Администрирование',
  '16-личные-кабинеты.md': 'Общее',
}

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
  э: 'e', ю: 'yu', я: 'ya',
}

export function handbookSlug(file: string): string {
  const base = file.replace(/\.md$/, '').replace(/^\d+-/, '').toLowerCase()
  return base.split('').map(ch => TRANSLIT[ch] ?? ch).join('')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function titleOf(body: string, fallback: string): string {
  const m = /^#\s+(.+)$/m.exec(body)
  return m ? m[1].trim() : fallback
}

function summaryOf(body: string): string | null {
  const lines = body.split('\n')
  const start = lines.findIndex(l => /^#\s+/.test(l))
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line.startsWith('#')) continue
    return line.replace(/\*\*/g, '').slice(0, 160)
  }
  return null
}

export interface HandbookChapter {
  slug: string
  title: string
  category: string
  summary: string | null
  body: string
  sort_order: number
  source_hash: string
}

/** Главы стандартного справочника в порядке файлов. */
export async function loadHandbookChapters(): Promise<HandbookChapter[]> {
  const dir = path.join(process.cwd(), 'docs', 'handbook')
  const files = (await readdir(dir)).filter(f => f.endsWith('.md') && f !== 'README.md').sort()
  const chapters: HandbookChapter[] = []
  for (const [index, file] of files.entries()) {
    const body = await readFile(path.join(dir, file), 'utf8')
    chapters.push({
      slug: handbookSlug(file),
      title: titleOf(body, file),
      category: CATEGORY[file] ?? 'Общее',
      summary: summaryOf(body),
      body,
      sort_order: index,
      source_hash: createHash('sha256').update(body, 'utf8').digest('hex'),
    })
  }
  return chapters
}
