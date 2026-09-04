#!/usr/bin/env node
/**
 * Заливает справочник из docs/handbook/ в базу знаний CRM.
 *
 * Запускается руками с машины: `npm run seed:handbook`. Идемпотентен —
 * статья ищется по slug и обновляется, так что повторный запуск после правки
 * файлов просто освежает тексты, а не плодит дубли.
 *
 * Правку, сделанную в самой CRM, не затирает. Раньше затирал молча: писал body
 * из файла поверх чего угодно, и правка исчезала без следа. Теперь при каждом
 * посеве сохраняется отпечаток файла (`source_hash`), и если текущий текст
 * статьи ему не соответствует — значит её правили в интерфейсе, и сеятель
 * такую статью пропускает и говорит об этом вслух.
 *
 * `--force` перезаписывает и расхождения: нужен, когда файл признан
 * источником правды и правку в CRM решили выбросить осознанно.
 *
 * Входит обычным пользователем (учётка из .env.e2e) и пишет от его имени —
 * RLS сама ограничивает запись его организацией. Service-role ключ не нужен и
 * в .env.local его нет.
 */

import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const DIR = 'docs/handbook'
const FORCE = process.argv.includes('--force')

const sha = text => createHash('sha256').update(text, 'utf8').digest('hex')

// Файл → рубрика в базе знаний. README не заливаем: его роль — оглавление
// репозитория, в CRM оглавление рисует сам раздел.
const CATEGORY = {
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
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const email = process.env.E2E_TEST_EMAIL
const password = process.env.E2E_TEST_PASSWORD

if (!url || !key) {
  console.error('Нет NEXT_PUBLIC_SUPABASE_URL или NEXT_PUBLIC_SUPABASE_ANON_KEY — проверьте .env.local')
  process.exit(1)
}
if (!email || !password) {
  console.error('Нет E2E_TEST_EMAIL / E2E_TEST_PASSWORD — они лежат в .env.e2e')
  process.exit(1)
}

const supabase = createClient(url, key)

const { data: auth, error: authError } = await supabase.auth.signInWithPassword({ email, password })
if (authError || !auth.user) {
  console.error('Не удалось войти:', authError?.message ?? 'нет пользователя')
  process.exit(1)
}

const { data: profile, error: profileError } = await supabase
  .from('users')
  .select('organization_id')
  .eq('id', auth.user.id)
  .single()

if (profileError || !profile?.organization_id) {
  console.error('Не найдена организация пользователя:', profileError?.message ?? '')
  process.exit(1)
}

const orgs = [{ id: profile.organization_id, name: 'своя организация' }]

/**
 * Тот же транслит, что и у редактора статей: адрес должен читаться и не
 * превращаться в процентную кашу при копировании ссылки.
 */
const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
  э: 'e', ю: 'yu', я: 'ya',
}

function slugOf(file) {
  const base = file.replace(/\.md$/, '').replace(/^\d+-/, '').toLowerCase()
  return base.split('').map(ch => TRANSLIT[ch] ?? ch).join('')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function titleOf(body, fallback) {
  const m = /^#\s+(.+)$/m.exec(body)
  return m ? m[1].trim() : fallback
}

/** Первый абзац после заголовка — краткое описание в списке. */
function summaryOf(body) {
  const lines = body.split('\n')
  const start = lines.findIndex(l => /^#\s+/.test(l))
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line.startsWith('#')) continue
    return line.replace(/\*\*/g, '').slice(0, 160)
  }
  return null
}

const files = readdirSync(DIR).filter(f => f.endsWith('.md') && f !== 'README.md').sort()
let created = 0
let updated = 0
const skipped = []
const unknown = []

for (const org of orgs) {
  for (const [index, file] of files.entries()) {
    const body = readFileSync(join(DIR, file), 'utf8')
    const slug = slugOf(file)
    const row = {
      organization_id: org.id,
      slug,
      title: titleOf(body, file),
      category: CATEGORY[file] ?? 'Общее',
      summary: summaryOf(body),
      body,
      sort_order: index,
      is_published: true,
      updated_at: new Date().toISOString(),
      source_hash: sha(body),
      // Посев из файла — это и есть проверка текста: главу только что писал
      // человек, глядя на текущий интерфейс.
      reviewed_at: new Date().toISOString(),
    }

    const { data: existing } = await supabase
      .from('knowledge_articles')
      .select('id, body, source_hash')
      .eq('organization_id', org.id)
      .eq('slug', slug)
      .maybeSingle()

    if (existing) {
      if (existing.source_hash) {
        // Отпечаток есть — вопрос решается точно: текст в базе не совпадает с
        // тем, что писал сеятель, значит статью правили в интерфейсе.
        if (sha(existing.body ?? '') !== existing.source_hash && !FORCE) {
          skipped.push(`${org.name} / ${slug}`)
          continue
        }
      } else if ((existing.body ?? '') !== body && !FORCE) {
        // Отпечатка нет — статья посеяна старой версией сеятеля. Отличить
        // «файл с тех пор правили» от «статью правили в CRM» невозможно:
        // сравнивать не с чем. Пропускаем и говорим об этом честно, вместо
        // того чтобы обвинять человека в правке, которой могло не быть.
        unknown.push(`${org.name} / ${slug}`)
        continue
      }

      const { error } = await supabase.from('knowledge_articles').update(row).eq('id', existing.id)
      if (error) { console.error(`${org.name} / ${slug}: ${error.message}`); process.exit(1) }
      updated += 1
    } else {
      const { error } = await supabase.from('knowledge_articles').insert(row)
      if (error) { console.error(`${org.name} / ${slug}: ${error.message}`); process.exit(1) }
      created += 1
    }
  }
}

console.log(
  `Готово: создано ${created}, обновлено ${updated}, пропущено ${skipped.length + unknown.length}`
)

if (skipped.length > 0) {
  console.log('')
  console.log('Пропущены — эти статьи правили в самой CRM, файл их не перезаписал:')
  for (const s of skipped) console.log(`  • ${s}`)
  console.log('')
  console.log('Перенести правку в docs/handbook/ вручную, либо выбросить её: npm run seed:handbook -- --force')
}

if (unknown.length > 0) {
  console.log('')
  console.log('Пропущены — текст в базе отличается от файла, но чья это правка, определить нечем:')
  for (const s of unknown) console.log(`  • ${s}`)
  console.log('')
  console.log('Эти статьи посеяны до появления отпечатка. Сверьте текст в CRM с файлом:')
  console.log('  • совпадает по смыслу (правил только файл) → npm run seed:handbook -- --force')
  console.log('  • в CRM есть чужие правки → перенесите их в docs/handbook/ и запустите снова')
  console.log('Отпечаток проставится при первом же успешном обновлении, и дальше вопрос решается точно.')
}
