/**
 * Поле формы, которое её обработчик не читает.
 *
 * Реальный случай: форма объекта отправляла `owner_contact_id`, а
 * `extractPropertyFields` это поле не читал — собственник объекта не
 * сохранялся вообще. Ни tsc, ни build такое не ловят: FormData не типизирована,
 * лишний ключ просто теряется. Внешне форма работает, поле молча пустое, а
 * всплывает через месяц в «Управлении» прочерком вместо собственника.
 *
 * Как проверяется: у формы находится её Server Action (`action={createXAction}`),
 * по импорту — файл экшена, в нём собираются `formData.get()` и ключи zod-схем,
 * которые он использует. Каждое имя поля формы должно быть среди них.
 * Сверять глобально по всему проекту бессмысленно: `owner_contact_id` есть в
 * схеме договора, и потерянное поле объекта так не видно.
 *
 * Файлы, у которых обработчик не определяется (части форм, клиентские формы
 * с fetch), не проверяются — иначе шум перекрыл бы находки.
 *
 * CLI: node scripts/checks/form-fields.mjs
 */

import path from 'node:path'
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { ROOT, walk, readSafe, rel } from './lib.mjs'

const SRC = path.join(ROOT, 'src')
const SCHEMAS_DIR = path.join(SRC, 'lib', 'schemas')

/** Поле в разметке: <input name="x">, <select name='x'>, <textarea name="x"> */
const FIELD_RE = /<(?:input|select|textarea)\b[^>]*?\bname=["']([a-zA-Z_][\w]*)["']/gs

/**
 * Поле внутри компонента-обёртки: там имя приходит пропсом со значением по
 * умолчанию (`name = 'owner_contact_id'`) — обычный FIELD_RE его не видит.
 */
const FIELD_IN_COMPONENT_RE = /\bname\s*=\s*["']([a-z_][\w]*)["']/g

/** action={createThingAction} или action={boundAction} / action={fn.bind(null, id)} */
const ACTION_ATTR_RE = /\baction=\{\s*([A-Za-z_$][\w$]*)/g

/** const boundAction = updateThingAction.bind(null, id) */
const BOUND_RE = /const\s+([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\.bind\(/g

const IMPORT_RE = /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g

/** Приёмники внутри файла экшена. */
const FORM_DATA_RE = /formData\.get(?:All)?\(\s*['"]([\w]+)['"]/g
const SCHEMA_USE_RE = /\b([A-Z][\w]*Schema)\b/g
/** Ключи zod-объекта: `  field_name: z.…` / `  field_name: optStr,` */
const SCHEMA_KEY_RE = /^\s{2,}([a-z_][\w]*)\s*:/gm

/** Компонент, использованный в JSX этого файла, вместе с его пропсами. */
const JSX_COMPONENT_RE = /<([A-Z][\w]*)\b([^>]*)>/g

/** Форма method="get" — значения уходят в query, их читает страница из searchParams. */
const GET_FORM_RE = /<form\b[^>]*method=["']get["']/is

/** Поля, которые по имени никто не читает намеренно. */
const ALLOWED = new Set([
  'consent', // чекбокс согласия на сайте — проверяется атрибутом required
  'company', // honeypot формы сайта: поле для ботов, его значение не нужно
])

/**
 * Суффикс служебного поля: radio-группе имя нужно только для эксклюзивности
 * переключателей, в базу такое значение не идёт (reward_model_ui).
 */
const UI_ONLY_SUFFIX = '_ui'

function resolveImport(spec, fromFile) {
  let base
  if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2))
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec)
  else return null

  for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

/** Ключи всех zod-схем проекта: { ContactSchema: Set<string> } */
function collectSchemas() {
  const byName = new Map()
  for (const file of walk(SCHEMAS_DIR, ['.ts'])) {
    const content = readSafe(file)
    if (content === null) continue
    // Схема = `export const XSchema = z.object({ … })`, границы — до следующего export.
    const parts = content.split(/^export\s+const\s+/m)
    for (const part of parts) {
      const m = part.match(/^([A-Za-z_$][\w$]*)\s*=/)
      if (!m) continue
      const keys = new Set()
      for (const k of part.matchAll(SCHEMA_KEY_RE)) keys.add(k[1])
      byName.set(m[1], keys)
    }
  }
  return byName
}

/** Что принимает файл экшена: formData.get(...) + ключи используемых схем. */
function sinksOfActionFile(file, schemas, seen = new Set()) {
  if (seen.has(file)) return new Set()
  seen.add(file)

  const content = readSafe(file)
  if (content === null) return new Set()

  const sinks = new Set()
  for (const m of content.matchAll(FORM_DATA_RE)) sinks.add(m[1])
  for (const m of content.matchAll(SCHEMA_USE_RE)) {
    for (const key of schemas.get(m[1]) ?? []) sinks.add(key)
  }

  // Экшен может звать хелпер из соседнего файла (extractPropertyFields и т.п.).
  for (const m of content.matchAll(IMPORT_RE)) {
    const target = resolveImport(m[2], file)
    if (!target || !rel(target).startsWith('src')) continue
    if (!/actions|schemas|lib/.test(rel(target))) continue
    for (const s of sinksOfActionFile(target, schemas, seen)) sinks.add(s)
  }
  return sinks
}

/**
 * Поля из компонентов, которые форма рендерит у себя внутри. Глубина два
 * уровня: `PartyContactSelect` → `QuickCreateContactForm` дальше не идёт,
 * но модалка быстрого создания шлёт свою FormData и здесь не считается.
 */
function childFieldsOf(file, content, depth = 2, seen = new Set()) {
  if (depth === 0 || seen.has(file)) return []
  seen.add(file)

  // Имя поля может быть задано пропсом на месте использования — тогда оно
  // важнее значения по умолчанию внутри компонента.
  const overrides = new Map()
  const used = new Set()
  for (const m of content.matchAll(JSX_COMPONENT_RE)) {
    used.add(m[1])
    const nameProp = m[2].match(/\bname=["']([\w]+)["']/)
    if (nameProp) {
      const list = overrides.get(m[1]) ?? []
      list.push(nameProp[1])
      overrides.set(m[1], list)
    }
  }
  const out = []

  for (const m of content.matchAll(IMPORT_RE)) {
    const imported = m[1].split(',').map(x => x.trim().split(/\s+as\s+/)[0].trim())
    if (!imported.some(name => used.has(name))) continue

    const target = resolveImport(m[2], file)
    if (!target || !target.endsWith('.tsx')) continue

    const childContent = readSafe(target)
    if (childContent === null) continue

    // Компонент со своей формой (модалка быстрого создания) шлёт данные сам —
    // его поля к обработчику внешней формы отношения не имеют.
    if (/<form\b/i.test(childContent)) continue

    const componentName = imported.find(name => used.has(name))
    const overridden = overrides.get(componentName)
    if (overridden) {
      // Имя поля задано на месте использования — значения по умолчанию
      // внутри компонента к этой форме отношения не имеют.
      for (const name of overridden) {
        out.push({ name, line: 1, where: rel(file) })
      }
    } else {
      for (const f of childContent.matchAll(FIELD_IN_COMPONENT_RE)) {
        out.push({
          name: f[1],
          line: childContent.slice(0, f.index).split('\n').length,
          where: rel(target),
        })
      }
    }
    out.push(...childFieldsOf(target, childContent, depth - 1, seen))
  }
  return out
}

export function checkFormFields(files) {
  const targets = files ?? walk(SRC, ['.ts', '.tsx'])
  const schemas = collectSchemas()
  const problems = []

  for (const file of targets) {
    if (!file.endsWith('.tsx')) continue
    const content = readSafe(file)
    if (content === null) continue
    if (GET_FORM_RE.test(content)) continue

    const fields = [...content.matchAll(FIELD_RE)].map(m => ({
      name: m[1],
      line: content.slice(0, m.index).split('\n').length,
      where: rel(file),
    }))

    // Поля, уехавшие в компоненты формы (OwnerSelectField, PartyContactSelect):
    // для обработчика это ровно те же ключи FormData.
    for (const child of childFieldsOf(file, content)) fields.push(child)

    if (fields.length === 0) continue

    // 1. Имя обработчика формы.
    const bound = new Map()
    for (const m of content.matchAll(BOUND_RE)) bound.set(m[1], m[2])

    const actionNames = new Set()
    for (const m of content.matchAll(ACTION_ATTR_RE)) {
      actionNames.add(bound.get(m[1]) ?? m[1])
    }
    if (actionNames.size === 0) continue

    // 2. Файлы, где эти обработчики объявлены.
    const actionFiles = new Set()
    for (const m of content.matchAll(IMPORT_RE)) {
      const imported = m[1].split(',').map(x => x.trim().split(/\s+as\s+/)[0].trim())
      if (!imported.some(name => actionNames.has(name))) continue
      const target = resolveImport(m[2], file)
      if (target) actionFiles.add(target)
    }
    if (actionFiles.size === 0) continue

    // 3. Что обработчик принимает.
    const sinks = new Set()
    for (const af of actionFiles) {
      for (const s of sinksOfActionFile(af, schemas)) sinks.add(s)
    }

    const reported = new Set()
    for (const { name, line, where } of fields) {
      if (sinks.has(name) || ALLOWED.has(name) || name.endsWith(UI_ONLY_SUFFIX)) continue
      if (reported.has(name)) continue
      reported.add(name)
      problems.push(
        `${where}:${line} — поле "${name}" отправляется формой ${rel(file)}, но обработчик ` +
          `(${[...actionNames].join(', ')}) его не читает. Значение молча теряется.`
      )
    }
  }
  return problems
}

// ── CLI ──────────────────────────────────────────────────────────────────
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = checkFormFields()
  if (problems.length === 0) {
    console.log('✅ Все поля форм доходят до обработчика')
    process.exit(0)
  }
  console.error('❌ Поля форм, которые теряются:\n')
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}
