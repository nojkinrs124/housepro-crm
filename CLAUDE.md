# HousePro CRM — Инструкция для Claude

Этот файл — главное руководство для работы с проектом. Читай его ПОЛНОСТЬЮ перед любой задачей.

> **Процесс и порядок работы** (как мы работаем, приоритеты техдолга, чек-листы до/во время/после задачи) — в [`docs/WORKFLOW.md`](./docs/WORKFLOW.md). Читать вместе с этим файлом: здесь — стек и паттерны кода, там — процесс.

## Стек проекта

- **Next.js 16.2.6** + **React 19** + **TypeScript**
- **Tailwind CSS v4** (без `tailwind.config.ts` конфигурации классов, только через postcss)
- **shadcn/ui** (компоненты в `src/components/ui/`)
- **Supabase** (PostgreSQL + Auth + Storage)
- **@dnd-kit** для Kanban drag-and-drop
- **react-hook-form** + **zod** для форм
- **docxtemplater** + **pizzip** для генерации DOCX
- **sonner** для toast-уведомлений
- **framer-motion** для анимаций
- **lucide-react** для иконок

## Подключение к инфраструктуре

```
Supabase URL:  https://zwclvcswvhjeqwxrkbte.supabase.co
Supabase Ref:  zwclvcswvhjeqwxrkbte
GitHub:        https://github.com/nojkinrs124/housepro-crm
Admin user ID: 508499ac-0268-49c7-9c31-8198deafeeda
```

## Настройка окружения в каждой сессии

```bash
# 1. Клонировать репо
git clone https://[PAT]@github.com/nojkinrs124/housepro-crm.git
cd housepro-crm

# 2. Установить зависимости (ОБЯЗАТЕЛЬНО --legacy-peer-deps)
npm install --legacy-peer-deps

# 3. Создать .env.local
cat > .env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://zwclvcswvhjeqwxrkbte.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[ANON_KEY]
EOF
```

**После push убирать PAT из remote URL:**
```bash
git remote set-url origin https://github.com/nojkinrs124/housepro-crm.git
```

---

## ОБЯЗАТЕЛЬНЫЕ ПРАВИЛА Next.js (нарушение = Runtime Error)

### ❌ ЗАПРЕЩЕНО в Server Components

```tsx
// НИКОГДА не добавляй event handlers в Server Component (файл без 'use client')
export default function Page() {
  return <button onClick={() => {}}>Click</button>  // ❌ ОШИБКА
}

// НИКОГДА не добавляй: onClick, onChange, onSubmit, onDrag, onMouseEnter и т.д.
// НИКОГДА не используй useState, useEffect, useTransition в Server Component
```

### ✅ ПРАВИЛЬНЫЙ ПАТТЕРН

```tsx
// Server Component (page.tsx) — только данные и разметка
import { DeleteButton } from './DeleteButton'  // ← client component

export default async function Page() {
  const data = await fetchData()
  return <DeleteButton id={data.id} />
}

// DeleteButton.tsx — отдельный файл с 'use client'
'use client'
import { deleteAction } from '../actions/delete.actions'

export function DeleteButton({ id }: { id: string }) {
  return <button onClick={() => deleteAction(id)}>Удалить</button>
}
```

**Правило**: любая интерактивность (кнопки, формы, drag) → отдельный Client Component с `'use client'` наверху.

---

## Структура файлов

```
src/
  app/
    (auth)/           # страницы авторизации
    (dashboard)/      # основные страницы CRM
      [модуль]/
        page.tsx          # Server Component, загружает данные
        [id]/page.tsx     # детальная карточка
        [id]/edit/page.tsx
        new/page.tsx
    api/              # API routes (XML экспорт и др.)
    layout.tsx
  components/
    layout/           # Sidebar, Header, NotificationBell
    search/           # GlobalSearch
    ui/               # shadcn компоненты
  features/
    [модуль]/
      actions/        # Server Actions ('use server')
      components/     # Client Components ('use client')
      services/       # бизнес-логика (document.service.ts и др.)
  lib/
    supabase/
      server.ts       # createClient() для Server Components и Actions
      client.ts       # createClient() для Client Components
    utils.ts
  types/
    database.ts       # все TypeScript типы
```

---

## Supabase — правила работы

### Клиент в Server Action / Server Component

```ts
import { createClient } from '@/lib/supabase/server'

export async function myAction() {
  const supabase = await createClient()  // ← await обязателен
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }
  // ...
}
```

### Клиент в Client Component

```tsx
'use client'
import { createClient } from '@/lib/supabase/client'  // ← другой путь!

const supabase = createClient()  // ← без await
```

### Схема изменений БД

**ВСЕГДА использовать `Supabase:apply_migration`**, никогда не `execute_sql` для DDL:

```sql
-- Шаблон миграции
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS new_field text;
CREATE INDEX IF NOT EXISTS idx_contacts_new_field ON contacts(new_field);

-- RLS политики — оборачивать в DO блок:
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Policy name' AND tablename = 'table'
  ) THEN
    CREATE POLICY "Policy name" ON table FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
```

### PostgREST — join с одной таблицей через несколько FK

```ts
// НЕВЕРНО — если два FK на contacts:
supabase.from('deals').select('*, contacts(*)')

// ВЕРНО — явные hints:
supabase.from('deals').select(`
  *,
  client:contacts!deals_client_contact_id_fkey(id, full_name, phone),
  owner:contacts!deals_owner_contact_id_fkey(id, full_name, phone)
`)
```

---

## Server Actions — шаблон

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createSomethingAction(formData: FormData) {
  const supabase = await createClient()
  
  // 1. Проверка авторизации
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }
  
  // 2. Получение и валидация данных
  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Заполните обязательные поля' }
  
  // 3. Операция с БД
  const { data, error } = await supabase
    .from('table')
    .insert({ name, created_by: user.id })
    .select()
    .single()
  
  if (error) return { error: error.message }
  
  // 4. Инвалидация кэша и редирект
  revalidatePath('/module')
  redirect(`/module/${data.id}`)
}
```

---

## База данных — таблицы

| Таблица | Назначение |
|---------|-----------|
| `users` | Сотрудники (связано с auth.users) |
| `contacts` | Единые контакты (клиенты + собственники, поле `role`) |
| `leads` | Лиды/заявки |
| `deals` | Сделки |
| `deal_comments` | Комментарии к сделкам |
| `properties` | Объекты недвижимости |
| `contracts` | Договоры |
| `payments` | Платежи |
| `tasks` | Задачи |
| `notifications` | Уведомления |
| `files` | Файловые вложения (метаданные) |
| `contract_versions` | Версии договоров |
| `clients` | Устаревшая, legacy (не использовать для новых фич) |
| `owners` | Устаревшая, legacy (не использовать для новых фич) |
| `contact_representatives` | Представители юрлица (директор/доверенное лицо), FK на `contacts.id` |

**Важно**: `clients` и `owners` — legacy таблицы для обратной совместимости. Все новые фичи работают через `contacts`.

### Поле role в contacts

```ts
type ContactRole = 'client' | 'owner' | 'both'
type ContactStatus = 'new' | 'active' | 'vip' | 'inactive'
```

### Физлицо / юрлицо (client_type)

`contacts.client_type`: `'individual' | 'legal_entity'` (default `'individual'`). Применимо к любой роли (клиент и/или собственник).

Физлицо использует существующие поля паспорта и адреса регистрации. Юрлицо использует: `company_name`, `inn`, `kpp`, `ogrn`, `legal_address`, `bank_name`, `bank_account`, `corr_account`, `bik`.

Представители юрлица — отдельная таблица `contact_representatives` (1 контакт-юрлицо → N представителей), управляются с карточки контакта (`RepresentativesPanel`). На `contracts` и `deals` есть `owner_representative_id` / `client_representative_id` — фиксируют, кто конкретно подписывал именно эту сделку/договор от лица компании.

Форма контакта (`ContactForm.tsx`) — переключатель типа реализован клиентским компонентом (radio + `useState`), сама форма по-прежнему отправляется через server action.

Выбор стороны в договорах/сделках — переиспользуемый компонент `PartyContactSelect.tsx` (`src/features/contacts/components/`): при выборе контакта-юрлица показывает дополнительный select «Представитель», подгружая список из `representativesByContact` (передаётся со страницы).

**Плейсхолдеры юрлица в генерации документов** (`document.service.ts`, для обеих сторон, суффикс `_АРЕНДОДАТЕЛЯ` / `_АРЕНДАТОРА`):
`НАЗВАНИЕ_ОРГАНИЗАЦИИ_*`, `ИНН_*`, `КПП_*`, `ОГРН_*`, `ЮР_АДРЕС_*`, `ФИО_ПРЕДСТАВИТЕЛЯ_*`, `ДОЛЖНОСТЬ_ПРЕДСТАВИТЕЛЯ_*`, `ОСНОВАНИЕ_ПРЕДСТАВИТЕЛЯ_*` (например: «Доверенности № 12 от 01.03.2026»). Для физлиц эти поля заполнены `_______________`, для юрлиц — старые паспортные плейсхолдеры. Шаблоны .docx нужно дополнить этими полями вручную через настройки → шаблоны документов.

---

## Supabase Storage

Бакеты:
- `documents` — договоры, документы
- `document-templates` — шаблоны DOCX
- `property-photos` — фото объектов
- `avatars` — аватары пользователей
- `passports` — паспорта
- `files` — прочие файлы

Валидация при загрузке:
- Блокировать: `exe, bat, cmd, com, msi, scr, vbs, js, jar, zip`
- Максимум: 20 МБ

---

## TypeScript — правила

```ts
// ❌ ЗАПРЕЩЕНО
const data: any = {}
const result = value as never
// eslint-disable-next-line @typescript-eslint/no-explicit-any

// ✅ ПРАВИЛЬНО
import type { Contact, Deal } from '@/types/database'
const data: Contact = {}
```

Все типы — в `src/types/database.ts`. Добавлять туда при создании новых сущностей.

---

## 🎨 ВИЗУАЛЬНЫЙ СТАНДАРТ — «КАБИНЕТ» (ОБЯЗАТЕЛЕН ДЛЯ ВСЕХ НОВЫХ СТРАНИЦ И КОМПОНЕНТОВ)

> **Правило**: при создании любой новой страницы, формы, карточки или компонента — строго следовать этому разделу. Отклонения от стандарта не допускаются.
>
> **История**: 28.08.2026 проект был переведён с «зелёного AI-SaaS» стиля на монохромную
> систему «Тихий фасад» (IBM Plex, radius 4px, прямоугольные бейджи — см.
> [`docs/DESIGN_SYSTEM_AUDIT.md`](./docs/DESIGN_SYSTEM_AUDIT.md)). 29.08.2026 — редизайн
> на **«Кабинет»**: источник — хэндофф-бандл из Claude Design («UI mockups for four
> directions»), гибрид направлений **1c «Кабинет»** (тёплая шалфейно-моховая палитра,
> Source Serif 4 + Source Sans 3, плоские панели radius 12px, без теней) и **1b
> «Инженерный реестр»** (структура «блоков» — секция с капс-заголовком и линованными
> строками лейбл/значение вместо рассыпанных мини-карточек, см. `.hp-block*` ниже).
> Миграция каталогом: `src/app/globals.css` (токены, обязательны к прочтению вместе с
> этим разделом), общий chrome (`Sidebar.tsx`, `Header.tsx`, `PageHeader.tsx`,
> `components/ui/button.tsx`) и модуль `contacts` уже переведены — это эталон. Остальные
> модули переводятся по мере работы с ними (см. `docs/WORKFLOW.md`), старые страницы пока
> держатся на псевдониме `--hp-gradient-primary → var(--hp-accent)` в `globals.css`,
> поэтому визуально не сломаны, но ещё не приведены к новым классам/радиусам/блокам.
>
> **Важно про шрифты**: в референсном мокапе 1c интерфейсный шрифт — Public Sans, но у
> него нет кириллицы (проверено на `fonts.google.com/metadata/fonts` — только
> latin/latin-ext/vietnamese). Заменён на **Source Sans 3** — кириллица подтверждена, и
> это официальная пара к Source Serif 4 у Adobe (та же суперсемья «Source»).

---

### Цветовая палитра и токены

Все значения — CSS-переменные в `src/app/globals.css` (`:root`). **В новом коде
использовать переменные** (`var(--hp-ink)` и т.д.) через inline `style` или Tailwind
arbitrary-классы (`text-[var(--hp-ink)]`), а не повторно хардкодить хекс — так любое
изменение палитры делается в одном файле, а не в 75 страницах, как было раньше.

```tsx
// ── Текст и поверхности — тёплый шалфейно-моховый тон ──
'var(--hp-ink)'          // #232A24 — основной текст
'var(--hp-sub)'          // #5C6659 — вторичный текст, роли, лейблы, метаданные
'var(--hp-tertiary)'     // #8A9382 — плейсхолдеры, неактивное
'var(--hp-bg)'           // #EEF0E9 — фон страницы
'var(--hp-surface)'      // #FBFBF8 — фон карточек/панелей
'var(--hp-border)'       // #DFE4D6 — hairline-граница
'var(--hp-border-soft)'  // #EAEEE2 — граница между строками таблицы/блока

// ── Акцент — ПЛОСКИЙ мховый зелёный, без градиента ──
'var(--hp-accent)'       // #4B6B46 — CTA-кнопки, активные состояния nav
'var(--hp-accent-hover)' // #3D5A39 — hover CTA
'var(--hp-neutral-tint)' // #E4E8DA — нейтральные плашки/иконки-боксы/фон сайдбара
'var(--hp-accent-tint)'  // #DBE1CF — активный пункт меню, выбранный фильтр-чип

// ── Семантика статусов (НЕ путать с акцентом — это разные вещи) ──
'var(--hp-good)'   / 'var(--hp-good-tint)'    // #3D6238 / #E2ECDD — активен, завершено
'var(--hp-warn)'   / 'var(--hp-warn-tint)'    // #7A6B3F / #F0ECDD — VIP, требует внимания
'var(--hp-danger)' / 'var(--hp-danger-tint)'  // #A24B30 / #F3E5E0 — просрочено, удаление — только тревожное
'var(--hp-info)'   / 'var(--hp-info-tint)'    // #41546B / #E6EAF0 — новое, информационное

// Радиус и тени — ОДНО значение на весь проект
'var(--hp-radius)'        // 12px — карточки, кнопки, инпуты, иконки-боксы. Разных радиусов нет.
'var(--hp-radius-badge)'  // 999px — бейджи-pill
'none'                    // теней в системе нет вообще — только плоский тон и hairline-граница
```

**Шрифты** (подключены в `globals.css`, ничего дополнительно импортировать не нужно):
- `Source Sans 3` — весь интерфейсный текст (body, лейблы, значения полей, кнопки, данные таблиц).
- `Source Serif 4` — H1/H2/H3 (уже настроено глобально на теге, специально указывать не нужно), крупные суммы на стат-карточках, заголовки секций форм. Засечный шрифт — задаёт тёплую, читаемую на весь день тональность.
- **Моно-шрифта для чисел в системе больше нет** (в отличие от «Тихого фасада») — телефоны/даты/суммы набираются обычным интерфейсным шрифтом, как в референсе 1c. Не добавлять `font-mono` в новом коде.
- Оба шрифта официально поддерживают кириллицу на Google Fonts — не заменять на Public Sans/Archivo/Sora/Work Sans/Karla без проверки кириллицы (`fonts.google.com/metadata/fonts` → поле `coverage`/`subsets`), у них её нет.

---

### Карточки-контейнеры

**Стандартная карточка:**
```tsx
<div className="bg-[var(--hp-surface)] rounded-[var(--hp-radius)] border border-[var(--hp-border)] p-5">
  ...
</div>
```

**Карточки в grid-строке (выровнять по высоте):**
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Карточки должны иметь h-full flex flex-col для равной высоты строки */}
  <div className="bg-[var(--hp-surface)] rounded-[var(--hp-radius)] border border-[var(--hp-border)] p-5 h-full flex flex-col">
    ...
  </div>
</div>
```

**Правила карточек:**
- Радиус: всегда `rounded-[var(--hp-radius)]` (12px) — единственный радиус в системе, включая вложенные карточки
- Padding: `p-5` (стандарт) — одинаково на всех страницах
- Border: `border border-[var(--hp-border)]` — **это и есть форма карточки**, тень не добавлять
- Hover (если карточка кликабельна): `hover:border-[var(--hp-sub)]` — граница темнеет, ничего не поднимается и не светится
- Заголовок секции внутри карточки: `font-bold text-[var(--hp-ink)] text-[15px]` (наследует Source Serif 4 через тег `h2`)

---

### «Блок» — секция-реестр (лейбл/значение), из направления «Инженерный реестр»

Для панелей с набором полей «подпись — значение» (детальная карточка, инфо-сайдбар) —
**не** рассыпать поля по мини-карточкам (`bg-muted/30 p-3` на каждое поле, старый паттерн
«Тихого фасада»), а собирать их в один `.hp-block` с капс-заголовком и линованными
строками. Полный рабочий пример — `src/app/(dashboard)/contacts/[id]/page.tsx` (эталон).

```tsx
<div className="hp-block">
  <div className="hp-block-header">Контактные данные</div>
  <div className="hp-block-row">
    <span className="label">Телефон</span>
    <a href={`tel:${phone}`} className="value hover:text-[var(--hp-accent)] transition-colors">{phone}</a>
  </div>
  <div className="hp-block-row">
    <span className="label">Email</span>
    <span className="value">{email}</span>
  </div>
</div>
```

`.hp-block` даёт скруглённую панель (радиус 12px, как у всех контейнеров в «Кабинете»);
`.hp-block-row` рисует ряды прямыми линиями внутри неё — сама секция скруглена, а данные
внутри читаются как реестр, а не как отдельные карточки. Готовые классы — в `globals.css`.

---

### Заголовки страниц (H1)

```tsx
// ✅ ЕДИНСТВЕННЫЙ допустимый стандарт для главного заголовка страницы
// font-family: Source Serif 4 подключается глобально через тег h1 — доп. класс не нужен
<h1 className="text-[27px] font-bold text-[var(--hp-ink)] tracking-tight leading-tight">
  Название страницы
</h1>

// Подзаголовок/описание под H1
<p className="text-[var(--hp-sub)] mt-1.5 text-sm font-medium">
  Описание или количество записей
</p>

// Заголовок секции внутри карточки (H2)
<h2 className="font-bold text-[var(--hp-ink)] text-[15px]">
  Название секции
</h2>
```

---

### CTA-кнопки (главные действия — Создать, Сохранить, Добавить)

```tsx
// ✅ СТАНДАРТ: плоский цвет, БЕЗ градиента, БЕЗ hover-подъёма — только смена фона
<Link
  href="/module/new"
  className="flex items-center gap-2 px-5 py-2.5 text-white rounded-[var(--hp-radius)] text-sm font-semibold transition-colors bg-[var(--hp-accent)] hover:bg-[var(--hp-accent-hover)]"
>
  <Plus className="w-4 h-4" />
  Добавить
</Link>

// Или готовый компонент (предпочтительно для новых страниц):
import { Button } from '@/components/ui/button'
<Button variant="primary"><Plus className="w-4 h-4" />Добавить</Button>
```

**Вторичная кнопка (Отмена, Назад, Редактировать):**
```tsx
<Link
  href="/module"
  className="flex items-center gap-2 px-5 py-2.5 bg-[var(--hp-surface)] border border-[var(--hp-border)] rounded-[var(--hp-radius)] text-sm font-semibold text-[var(--hp-ink)] hover:border-[var(--hp-sub)] transition-colors"
>
  Отмена
</Link>
```

---

### Поля форм (input, select, textarea)

**ЕДИНСТВЕННЫЙ допустимый стандарт для всех полей:**

```tsx
// Лейбл — обычный регистр, не капс (см. .hp-label в globals.css)
<label className="hp-label">Название поля</label>

// Input
<input
  type="text"
  name="field"
  placeholder="Подсказка"
  className="w-full h-10 px-4 rounded-[var(--hp-radius)] border border-[var(--hp-border)] bg-[var(--hp-surface)] text-[var(--hp-ink)] placeholder:text-[var(--hp-tertiary)] text-sm outline-none focus:border-[var(--hp-ink)] transition-colors"
/>

// Select
<select
  name="field"
  className="w-full h-10 px-4 rounded-[var(--hp-radius)] border border-[var(--hp-border)] bg-[var(--hp-surface)] text-[var(--hp-ink)] text-sm outline-none focus:border-[var(--hp-ink)] cursor-pointer transition-colors"
>
  <option value="">— выберите —</option>
</select>

// Textarea
<textarea
  name="field"
  rows={3}
  placeholder="Подсказка"
  className="w-full px-4 py-2.5 rounded-[var(--hp-radius)] border border-[var(--hp-border)] bg-[var(--hp-surface)] text-[var(--hp-ink)] placeholder:text-[var(--hp-tertiary)] text-sm outline-none focus:border-[var(--hp-ink)] transition-colors resize-none"
/>

// Date input (min-width важен для iOS Safari)
<input
  type="date"
  name="field"
  className="w-full min-w-0 h-10 px-4 rounded-[var(--hp-radius)] border border-[var(--hp-border)] bg-[var(--hp-surface)] text-[var(--hp-ink)] text-sm outline-none focus:border-[var(--hp-ink)] transition-colors"
/>
```

Готовые классы `.hp-input` / `.hp-label` в `globals.css` делают то же самое — можно
использовать их напрямую вместо повторения classNames.

**Правила полей:**
- Высота: `h-10` (40px) для input и select — жёстко везде
- Padding: `px-4` — жёстко везде (не px-3!)
- Радиус: `rounded-[var(--hp-radius)]` — везде, полей и кнопок это тоже касается (радиус один на всё)
- Граница: `border border-[var(--hp-border)]`
- Фокус: `focus:border-[var(--hp-ink)]` — граница темнеет, **не `ring`** (кольца — не часть системы)
- Select: всегда `cursor-pointer`

---

### Структура страницы-списка (list page)

Полный рабочий пример — `src/app/(dashboard)/contacts/page.tsx` (эталон).

```tsx
export default async function ModulePage() {
  return (
    <div className="space-y-6">

      {/* 1. Шапка страницы */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-[27px] font-bold text-[var(--hp-ink)] tracking-tight leading-tight">
            Название раздела
          </h1>
          <p className="text-[var(--hp-sub)] mt-1 text-sm font-medium">N записей</p>
        </div>
        <Link href="/module/new"
          className="flex items-center gap-2 px-5 py-2.5 text-white rounded-[var(--hp-radius)] text-sm font-semibold transition-colors bg-[var(--hp-accent)] hover:bg-[var(--hp-accent-hover)]">
          <Plus style={{ width: 16, height: 16 }} />
          Добавить
        </Link>
      </div>

      {/* 2. Stat-карточки (опционально) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(stat => (
          <div key={stat.label} className="bg-[var(--hp-surface)] rounded-[var(--hp-radius)] border border-[var(--hp-border)] p-5 flex items-center gap-3 sm:gap-4">
            <div className="w-11 h-11 rounded-[var(--hp-radius)] flex items-center justify-center shrink-0 bg-[var(--hp-neutral-tint)] border border-[var(--hp-border)]">
              <stat.Icon style={{ width: 20, height: 20, color: 'var(--hp-sub)' }} />
            </div>
            <div className="min-w-0"> {/* ← ОБЯЗАТЕЛЕН для предотвращения overflow */}
              <p className="text-2xl font-bold text-[var(--hp-ink)]">{stat.value}</p>
              <p className="text-xs text-[var(--hp-sub)] font-medium mt-0.5 leading-tight break-words">
                {stat.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* 3. Основная таблица/список */}
      <div className="bg-[var(--hp-surface)] rounded-[var(--hp-radius)] border border-[var(--hp-border)] overflow-hidden">
        {!items?.length ? (
          /* Empty state */
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-[var(--hp-radius)] flex items-center justify-center mx-auto mb-4 bg-[var(--hp-neutral-tint)] border border-[var(--hp-border)]">
              <Icon style={{ width: 24, height: 24, color: 'var(--hp-sub)' }} />
            </div>
            <p className="text-[var(--hp-ink)] font-bold text-base">Записей ещё нет</p>
            <p className="text-[var(--hp-sub)] text-sm mt-1">Добавьте первую запись</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--hp-border-soft)]">
            {items.map(item => (
              <Link key={item.id} href={`/module/${item.id}`}
                className="flex items-center gap-4 px-6 py-4 hover:bg-[var(--hp-neutral-tint)] transition-colors duration-150 group">
                {/* контент строки */}
              </Link>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
```

---

### Структура страницы-формы (new/edit page)

Полный рабочий пример — `src/app/(dashboard)/contacts/new/page.tsx` (эталон).

```tsx
export default async function NewModulePage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* 1. Back link */}
      <Link href="/module" className="hp-back-link inline-flex items-center gap-2">
        <ArrowLeft style={{ width: 16, height: 16 }} />
        Вернуться к разделу
      </Link>

      {/* 2. Заголовок с иконкой */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-[var(--hp-radius)] flex items-center justify-center shrink-0 bg-[var(--hp-neutral-tint)] border border-[var(--hp-border)]">
          <Icon style={{ width: 20, height: 20, color: 'var(--hp-ink)' }} />
        </div>
        <div>
          <h1 className="text-[27px] font-bold text-[var(--hp-ink)] tracking-tight leading-tight">
            Новая запись
          </h1>
          <p className="text-[var(--hp-sub)] text-sm font-medium mt-0.5">Описание</p>
        </div>
      </div>

      {/* 3. Форма с секциями */}
      <form action={createAction}>
        <div className="bg-[var(--hp-surface)] rounded-[var(--hp-radius)] border border-[var(--hp-border)] p-5 space-y-4">
          <h2 className="font-bold text-[var(--hp-ink)] text-[15px]">Основные данные</h2>

          <div className="space-y-1.5">
            <label className="hp-label">Название *</label>
            <input type="text" name="title" placeholder="Введите название"
              className="w-full h-10 px-4 rounded-[var(--hp-radius)] border border-[var(--hp-border)] bg-[var(--hp-surface)] text-[var(--hp-ink)] placeholder:text-[var(--hp-tertiary)] text-sm outline-none focus:border-[var(--hp-ink)] transition-colors" />
          </div>

          {/* Сетка из нескольких полей — ВСЕГДА responsive */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="hp-label">Поле 1</label>
              <input type="text" name="field1"
                className="w-full h-10 px-4 rounded-[var(--hp-radius)] border border-[var(--hp-border)] bg-[var(--hp-surface)] text-[var(--hp-ink)] text-sm outline-none focus:border-[var(--hp-ink)] transition-colors" />
            </div>
            <div className="space-y-1.5">
              <label className="hp-label">Поле 2</label>
              <input type="text" name="field2"
                className="w-full h-10 px-4 rounded-[var(--hp-radius)] border border-[var(--hp-border)] bg-[var(--hp-surface)] text-[var(--hp-ink)] text-sm outline-none focus:border-[var(--hp-ink)] transition-colors" />
            </div>
          </div>
        </div>

        {/* 4. Кнопки действий */}
        <div className="flex items-center gap-3 pt-4">
          <button type="submit"
            className="flex items-center gap-2 px-6 py-2.5 text-white rounded-[var(--hp-radius)] text-sm font-semibold transition-colors bg-[var(--hp-accent)] hover:bg-[var(--hp-accent-hover)]">
            Создать
          </button>
          <Link href="/module"
            className="px-6 py-2.5 bg-[var(--hp-surface)] border border-[var(--hp-border)] rounded-[var(--hp-radius)] text-sm font-semibold text-[var(--hp-ink)] hover:border-[var(--hp-sub)] transition-colors">
            Отмена
          </Link>
        </div>
      </form>

    </div>
  )
}
```

---

### Структура детальной страницы ([id]/page.tsx)

Полный рабочий пример — `src/app/(dashboard)/contacts/[id]/page.tsx` (эталон): секции
данных собраны через `.hp-block` (см. выше), а не через мини-карточки на каждое поле.

```tsx
export default async function ModuleDetailPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* 1. Back link */}
      <Link href="/module" className="hp-back-link inline-flex items-center gap-2">
        <ArrowLeft style={{ width: 16, height: 16 }} />
        Назад
      </Link>

      {/* 2. Шапка — ОБЯЗАТЕЛЬНО flex-col sm:flex-row (защита от overflow на мобилке) */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0"> {/* ← min-w-0 обязателен */}
          <div className="w-14 h-14 rounded-[var(--hp-radius)] bg-[var(--hp-neutral-tint)] border border-[var(--hp-border)] flex items-center justify-center shrink-0">
            <Icon className="w-7 h-7" style={{ color: 'var(--hp-ink)' }} />
          </div>
          <div className="min-w-0"> {/* ← min-w-0 обязателен */}
            <h1 className="text-[27px] font-bold text-[var(--hp-ink)] tracking-tight leading-tight break-words">
              {item.title}
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="hp-badge hp-badge-good">Активен</span>
            </div>
          </div>
        </div>
        {/* Кнопки действий — flex-wrap + shrink-0 + whitespace-nowrap */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Link href={`/module/${id}/edit`}
            className="flex items-center gap-2 px-4 py-2 border border-[var(--hp-border)] rounded-[var(--hp-radius)] text-sm font-medium text-[var(--hp-ink)] hover:border-[var(--hp-sub)] transition-colors whitespace-nowrap">
            <Edit className="w-4 h-4" />
            Редактировать
          </Link>
          <DeleteButton itemId={id} />
        </div>
      </div>

      {/* 3. Секции данных — .hp-block, не мини-карточки на поле */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="hp-block">
            <div className="hp-block-header">Основная информация</div>
            <div className="hp-block-row">
              <span className="label">Поле</span>
              <span className="value">Значение</span>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          {/* боковые .hp-block */}
        </div>
      </div>

    </div>
  )
}
```

---

### Бейджи статусов — pill

```tsx
// ✅ СТАНДАРТ — используй готовые классы из globals.css
<span className="hp-badge hp-badge-good">Активен</span>      {/* зелёный — успех/завершено */}
<span className="hp-badge hp-badge-warn">VIP</span>          {/* охра — требует внимания */}
<span className="hp-badge hp-badge-info">Новый</span>        {/* синий — новое/информационное */}
<span className="hp-badge hp-badge-danger">Просрочено</span> {/* терракота — только тревожное, не «неактивный» */}
<span className="hp-badge hp-badge-neutral">Клиент</span>    {/* серо-зелёный — роль, неактивный статус */}

// Если готового класса не хватает — руками, но радиус и шрифт те же:
<span className="inline-flex items-center gap-1 px-[11px] py-1 rounded-[var(--hp-radius-badge)] text-[11.5px] font-semibold"
  style={{ background: 'var(--hp-good-tint)', color: 'var(--hp-good)' }}>
  Активен
</span>
```

**Важно**: бейдж — это заливка цветом самого текста/фона, **не** обводка слева
цветной полосой на карточке (частый AI-generated паттерн — в этом проекте не используется).
`hp-danger` — только для по-настоящему тревожных состояний (просрочено, удаление); статус
«неактивный» — это `hp-badge-neutral`, а не danger.

---

### Адаптивность — обязательные правила

```tsx
// ❌ ЗАПРЕЩЕНО — фиксированные сетки без breakpoint
<div className="grid grid-cols-3 gap-4">   // сломается на мобилке

// ✅ ОБЯЗАТЕЛЬНО — responsive сетки
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

// ❌ ЗАПРЕЩЕНО — flex без wrap на кнопках/бейджах
<div className="flex gap-2">   // кнопки/бейджи могут выйти за экран

// ✅ ОБЯЗАТЕЛЬНО — flex с wrap и shrink на длинном тексте
<div className="flex items-center gap-2 flex-wrap">
  <span className="flex-1 min-w-0 truncate">Длинное название...</span>
  <span className="shrink-0 whitespace-nowrap">Бейдж</span>
</div>

// ❌ ЗАПРЕЩЕНО — шапка detail-страницы без переноса на мобилке
<div className="flex items-start justify-between">

// ✅ ОБЯЗАТЕЛЬНО — шапка detail-страницы
<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
```

---

### Stat-карточки в grid — защита от overflow

```tsx
// ❌ ЗАПРЕЩЕНО — текстовый блок без min-w-0 (вызывает overflow длинных слов)
<div className="flex items-center gap-4">
  <Icon />
  <div>                          {/* ← нет min-w-0 */}
    <p>{count}</p>
    <p>{label}</p>               {/* "Администратор" выходит за рамку */}
  </div>
</div>

// ✅ ОБЯЗАТЕЛЬНО
<div className="flex items-center gap-3 sm:gap-4">
  <Icon className="shrink-0" />
  <div className="min-w-0">                    {/* ← ОБЯЗАТЕЛЕН */}
    <p className="text-2xl font-bold text-[var(--hp-ink)]">{count}</p>
    <p className="text-xs text-[var(--hp-sub)] font-medium mt-0.5 leading-tight break-words">
      {label}                                  {/* ← break-words ОБЯЗАТЕЛЕН */}
    </p>
  </div>
</div>
```

---

### Иконки, аватары и цветовое кодирование модулей

```tsx
// Иконка-бокс — стандарт: нейтральная заливка + hairline-граница, НЕ цветной bg-green-50
<div className="w-11 h-11 rounded-[var(--hp-radius)] flex items-center justify-center shrink-0 bg-[var(--hp-neutral-tint)] border border-[var(--hp-border)]">
  <Icon style={{ width: 20, height: 20, color: 'var(--hp-ink)' }} />
</div>

// Аватар-инициал — плоский акцент, без градиента
<div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white text-sm font-bold"
  style={{ background: 'var(--hp-accent)' }}>
  {name?.charAt(0)?.toUpperCase() ?? '?'}
</div>
```

Цветовое кодирование модулей по разным цветам Tailwind (`bg-blue-100` для лидов,
`bg-violet-100` для договоров и т.п., унаследовано из старых страниц) — **legacy,
не копировать в новый код**: единственный акцент в системе — `var(--hp-accent)`,
цвет несёт только семантика статуса (good/warn/danger), не принадлежность к модулю.

---

### Анимации — единый стандарт

```tsx
// Hover на карточке/строке — ТОЛЬКО смена цвета границы или фона, без transform
className="transition-colors hover:border-[var(--hp-sub)]"
className="transition-colors duration-150 hover:bg-[var(--hp-neutral-tint)]"

// ❌ ЗАПРЕЩЕНО — подъём/скейл/тень при hover (был стандартом в старой системе)
className="hover:-translate-y-0.5 hover:shadow-lg"

// Framer Motion — только для активного пункта Sidebar (layoutId, уже реализовано)
// и Kanban drag-and-drop. Для обычных страниц не использовать.
```

---

### Горизонтальное переполнение (overflow) — запрещено

```tsx
// ❌ ЗАПРЕЩЕНО на любом detail-компоненте — кнопки выйдут за экран
<div className="flex gap-2">
  <button>Редактировать</button>
  <button>Удалить</button>
  <button>Сформировать DOCX</button>
</div>

// ✅ ОБЯЗАТЕЛЬНО — группа кнопок всегда с flex-wrap
<div className="flex items-center gap-2 flex-wrap shrink-0">
  <button className="whitespace-nowrap">Редактировать</button>
  <button className="whitespace-nowrap">Удалить</button>
</div>

// Date inputs — НИКОГДА без min-w-0 (iOS Safari overflow)
<input type="date" className="w-full min-w-0 h-10 ..." />
```

---

### Вертикальный ритм страниц

```tsx
// Корневой отступ между секциями — ВСЕГДА space-y-6
<div className="space-y-6">

// Отступ между полями в форме — space-y-4 или space-y-1.5 (label+input)
<div className="space-y-4">
  <div className="space-y-1.5">
    <label>...</label>
    <input ... />
  </div>
</div>

// Gap в grid-сетке — gap-4
<div className="grid ... gap-4">
```

---

### Чеклист при создании новой страницы

Перед push ОБЯЗАТЕЛЬНО проверить:

- [ ] H1 — `text-[27px] font-bold text-[var(--hp-ink)] tracking-tight leading-tight` (шрифт Source Serif 4 — уже глобально на теге)
- [ ] Карточки — `rounded-[var(--hp-radius)] border border-[var(--hp-border)] p-5`, **без** `boxShadow`/`shadow-*`
- [ ] CTA-кнопка — `bg-[var(--hp-accent)] hover:bg-[var(--hp-accent-hover)]`, `rounded-[var(--hp-radius)]`, без градиента и без `hover:-translate-y`
- [ ] Поля форм — `h-10 px-4 rounded-[var(--hp-radius)] border border-[var(--hp-border)] focus:border-[var(--hp-ink)]` (не `ring`)
- [ ] Секции «лейбл/значение» на детальных страницах — `.hp-block` + `.hp-block-row`, не мини-карточки на поле
- [ ] Бейджи — `.hp-badge hp-badge-{good|warn|info|danger|neutral}` (pill), `hp-danger` — только для тревожного (не для «неактивный»)
- [ ] Радиус везде один — `12px` (карточки, кнопки, инпуты, иконки-боксы); бейджи — `999px` (pill)
- [ ] Нет `font-mono`/IBM Plex Mono в новом коде — числа набираются обычным интерфейсным шрифтом
- [ ] Сетки — `grid-cols-1 sm:grid-cols-N` (НЕ `grid-cols-N` без breakpoint)
- [ ] Шапка detail — `flex flex-col sm:flex-row sm:justify-between gap-4`
- [ ] Кнопки в шапке — `flex-wrap shrink-0 whitespace-nowrap`
- [ ] Stat-карточки — `min-w-0` + `break-words` на текстовом блоке
- [ ] Back link — класс `.hp-back-link`
- [ ] `space-y-6` на корневом div страницы
- [ ] Нет захардкоженных `#16A34A`/`#22C55E`/`linear-gradient`/`rounded-[4px]`/`rounded-[20px]` — только токены `var(--hp-*)`



**После каждой завершённой фазы работы:**

```bash
# 1. ОБЯЗАТЕЛЬНАЯ проверка перед пушем — единый скрипт:
#    tsc --noEmit → event handlers в Server Components →
#    импорт функций из 'use client' файлов в серверные файлы (см. ниже) →
#    npm run build → npm test
npm run check
# Если хоть один шаг красный (❌) — пуш запрещён, пока не исправлено.

# 2. Коммит и пуш
git add -A
git commit -m "feat: описание что сделано"
git push origin main
```

Без push изменения потеряются при смене сессии. **Без исключений.**

### `npm run check` — что именно проверяет (scripts/pre-push-check.mjs)

Одного `tsc --noEmit` и даже `next build` НЕДОСТАТОЧНО: страницы с
`export const dynamic = 'force-dynamic'` или использующие `cookies()`
Next.js помечает как `ƒ Dynamic` и НЕ выполняет их тело во время сборки —
поэтому ошибка типа «функция из клиентского компонента вызвана на
сервере» проходит мимо `tsc` и мимо `build`, и всплывает только в
реальном запросе в проде (баг с `toExtraFieldsDefaults`, июль 2026).

Скрипт добавляет статическую проверку границы client/server: находит все
файлы с `'use client'`, собирает их "функциональные" экспорты (имена с
маленькой буквы — не React-компоненты, которые PascalCase), и проверяет,
что ни один серверный файл не импортирует такую функцию напрямую (можно
только рендерить PascalCase-компоненты как JSX). При нарушении — понятная
ошибка с указанием файла и что куда вынести (обычно — в отдельный файл
без `'use client'`, см. `src/features/contracts/utils/rent-apartment-data.ts`
как образец: чистые типы/функции отдельно от React-компонента).

Тот же скрипт (`npm run check`) гоняется и в GitHub Actions CI
(`.github/workflows/ci.yml`) — так что даже если проверка перед пушем
пропущена вручную, PR/push в main будет отмечен красным на GitHub.

---

## Установленные пакеты (не переустанавливать, не заменять)

| Что нужно | Пакет |
|-----------|-------|
| Drag-and-drop | `@dnd-kit/core` + `@dnd-kit/sortable` |
| Формы | `react-hook-form` + `@hookform/resolvers` + `zod` |
| DOCX генерация | `docxtemplater` + `pizzip` |
| Toast | `sonner` |
| Анимации | `framer-motion` |
| Иконки | `lucide-react` |
| UI компоненты | `@radix-ui/*` через shadcn |

**НЕ добавлять**: `@hello-pangea/dnd`, `react-beautiful-dnd`, `axios`, `react-query` — в проекте их нет и они не нужны.

---

## Частые ошибки и решения

### "Event handlers cannot be passed to Client Component props"
→ Убрать onClick/onChange/onSubmit из Server Component. Создать отдельный файл с `'use client'`.

### "Cannot find module '@/utils/supabase/server'"
→ Правильный путь: `@/lib/supabase/server` (не `utils`).

### npm install падает с peer dependency ошибкой
→ Всегда `npm install --legacy-peer-deps`.

### PostgREST: "Could not embed..."
→ Использовать hint синтаксис: `contacts!deals_client_contact_id_fkey(fields)`.

### Supabase прямые HTTP запросы не работают
→ `api.supabase.com` заблокирован. Использовать только MCP коннектор Supabase.

### \"the name X is defined multiple times\" (Turbopack build error)
→ Перед добавлением функции в существующий actions файл **всегда проверять** что такой функции там ещё нет:
```bash
grep -n "functionName" src/features/module/actions/module.actions.ts
```
Если функция уже есть — использовать её, не добавлять новую. Особенно актуально для `delete*Action` — они часто уже существуют в файлах.

### RLS политика уже существует
→ Оборачивать в `DO $$ BEGIN IF NOT EXISTS ... END $$`.

---

## Модули проекта — статус

| Модуль | Страницы | Статус |
|--------|----------|--------|
| Auth | `/login` | ✅ |
| Dashboard | `/dashboard` | ✅ |
| Leads | `/leads` + Kanban | ✅ |
| Contacts | `/contacts` (unified clients+owners) | ✅ |
| Deals | `/deals` + Kanban + комментарии | ✅ |
| Properties | `/properties` | ✅ |
| Contracts | `/contracts` + генерация DOCX | ✅ |
| Payments | `/payments` + `/payments/[id]` | ✅ |
| Tasks | `/tasks` + Kanban + `/tasks/[id]` | ✅ |
| Employees | `/employees` | ✅ |
| Search | `/search` (Ctrl+K) | ✅ |
| Export | `/export` (Avito/CIAN XML) | ✅ |
| Analytics | `/analytics` (Recharts: funnel, payments, conversion) | ✅ |
| Settings | `/settings/*` | ✅ |
| Notifications | bell + pg_cron | ✅ |
| Files | upload + preview + magic bytes validation | ✅ |

---

## Коммуникация с Русланом

- Короткие команды: "продолжай", "далее", "делай" = одобрение, продолжать без уточнений
- Принимать архитектурные решения самостоятельно
- Только production-ready код, никаких заглушек
- Compact summary в конце сессии для экономии контекста

---

## Claude Skills (jeffallan/claude-skills v0.4.12)

Установлены в `.claude/skills/` — 12 специализированных скилов для стека проекта.

### Активные скилы

| Скил | Когда активировать |
|------|--------------------|
| `nextjs-developer` | App Router, Server Components, Server Actions, Vercel деплой |
| `react-expert` | React 19, хуки, состояние, производительность |
| `typescript-pro` | Типы, generics, strict mode, Supabase types |
| `postgres-pro` | SQL оптимизация, индексы, JSONB, PostgREST |
| `fullstack-guardian` | Code review всего стека перед push |
| `debugging-wizard` | Диагностика ошибок Vercel/Supabase/TS |
| `secure-code-guardian` | RLS политики, auth, input validation |
| `feature-forge` | Проектирование новых фич |
| `api-designer` | REST endpoints, server actions API design |
| `test-master` | Тесты для критичных модулей |
| `code-reviewer` | Pre-push review |
| `javascript-pro` | JS паттерны, async, performance |

### Команды

- `/common-ground` — синхронизация контекста проекта с Claude Code
- `/intake` — intake новой фичи
- `/project` — workflow управление

### Использование

Скилы активируются автоматически по контексту запроса в **Claude Code**.
В этом чате (claude.ai) — читать SKILL.md вручную при необходимости.

---

## Подход к улучшениям проекта (IMPROVEMENTS workflow)

В каждой новой сессии — после чтения CLAUDE.md — проверять `docs/IMPROVEMENTS.md` на открытые задачи.

### Приоритеты

| Приоритет | Описание | Действие |
|-----------|----------|----------|
| 🔴 P0 | Критично: безопасность, data corruption, build broken | Исправить немедленно до любой другой работы |
| 🟠 P1 | Высокий: UX, производительность, архитектура | Следующие в очереди |
| 🟡 P2 | Средний: качество кода, рефакторинг | После P1 |
| 🔵 P3 | Долгосрочное: тесты, мониторинг, rate limiting | По возможности |

### Workflow каждой сессии

```
1. git clone + npm install --legacy-peer-deps
2. Прочитать CLAUDE.md (этот файл)
3. Прочитать docs/IMPROVEMENTS.md — найти первый открытый пункт
4. Работать по порядку P0 → P1 → P2 → P3
5. npm test — все тесты должны быть зелёными перед пушем
6. npm run build локально перед каждым git push — только зелёный билд идёт в прод
6. После завершения пункта — пометить ✅ в IMPROVEMENTS.md, запушить
```

### Правило локального билда (ОБЯЗАТЕЛЬНО)

**Никогда не пушить без локальной проверки:**

```bash
npm run build
# Должно завершиться:
# ✓ Compiled successfully
# ✓ Generating static pages (36/36)
# Ноль Type error, ноль Ecmascript errors
```

Если билд упал — исправить до пуша. Не допускать красных деплоев на Vercel.

### Анализ проекта через скилы

Перед написанием кода активировать релевантные скилы из `.claude/skills/`:
- Новая фича → `feature-forge` + профильный скил стека
- Рефакторинг → `code-reviewer` + `fullstack-guardian`
- БД изменения → `postgres-pro`
- Безопасность → `secure-code-guardian`
- Баг → `debugging-wizard`

### Формат коммитов

```
feat(module): краткое описание

- детали что сделано
- Build: verified locally N/N pages, 0 errors
```

---

## Статус улучшений (последнее обновление)

| # | Задача | Статус |
|---|--------|--------|
| P0-1 | middleware.ts — защита роутов | ✅ |
| P0-2 | Zod-валидация в core actions | ✅ |
| P0-3 | Search: clients → contacts | ✅ |
| P1-4 | loading.tsx + error.tsx | ✅ |
| P1-5 | unstable_cache для analytics | ✅ |
| P1-6 | useActionState для форм | ✅ |
| P1-7 | RLS: public → authenticated | ✅ |
| P2-8 | Типизация — автогенерация из Supabase | 🔵 P3 |
| P2-9 | select('*') → явные поля | ✅ |
| P2-10 | GIN-индексы pg_trgm | ✅ |
| P2-11 | env.ts — валидация переменных | ✅ |
| P2-12 | Analytics рефакторинг + shared utils | ✅ |
| P3-13 | Тесты (Vitest) | ✅ |
| P3-14 | Rate limiting (in-memory) | ✅ |
| P3-15 | Мониторинг (Sentry) | ✅ |
| P3-16 | next/image remotePatterns | ✅ |

---

## 🚀 SAAS TRANSFORMATION ROADMAP

> **Цель**: трансформировать single-tenant CRM в полноценный SaaS-продукт.  
> После выполнения всех фаз останется только ценообразование и продажа.  
> **Порядок фаз нарушать НЕЛЬЗЯ** — каждая фаза является фундаментом для следующей.

---

### Общая карта фаз

| Фаза | Что делаем | Срок | Результат |
|------|-----------|------|-----------|
| **Phase 0** | Preflight: типы, middleware, Redis, CI | 1–2 дня | Критические баги prod устранены |
| **Phase 1** | Multi-tenant: org_id, RLS, JWT | 3–4 нед. | Данные агентств изолированы |
| **Phase 2** | Security: Audit log, версионирование, permissions | 1–2 нед. | Compliance-ready |
| **Phase 3** | PropTech: показы, подборки, email, KPI | 3–4 нед. | Конкурентный продукт |
| **Phase 4** | SaaS core: Stripe, onboarding, PWA | 4–6 нед. | Можно принимать оплату |
| **Phase 5** | API & интеграции | 4–6 нед. | Enterprise-ready |

---

## PHASE 0 — Preflight (1–2 дня)

Исправляем критические production-баги без архитектурных изменений.

### 0.1 Генерация реальных Supabase типов

**Проблема:** `export type Database = any` в `src/types/database.ts` — убивает всю типобезопасность.

```bash
# Установить CLI
npm install -g supabase --legacy-peer-deps

# Добавить в .env.local:
# SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Сгенерировать типы
npx supabase gen types typescript \
  --project-id zwclvcswvhjeqwxrkbte \
  --schema public \
  > src/types/supabase.ts

# Добавить скрипт в package.json:
# "db:types": "supabase gen types typescript --project-id zwclvcswvhjeqwxrkbte --schema public > src/types/supabase.ts"
```

```ts
// src/types/database.ts — ЗАМЕНИТЬ строку: export type Database = any
// НА:
export type { Database } from './supabase'
```

**После каждой миграции БД:** `npm run db:types`

---

### 0.2 middleware.ts — централизованная защита роутов

**Проблема:** Нет файла `middleware.ts`. Любой новый `page.tsx` без проверки auth — публично доступен.

```ts
// middleware.ts — создать в КОРНЕ проекта (рядом с package.json)
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = [
  '/login',
  '/auth/callback',
  '/auth/reset-password',
  '/api/public',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/stripe|api/export).*)',
  ],
}
```

---

### 0.3 Upstash Redis — production-grade rate limiting

**Проблема:** In-memory rate limiter сбрасывается при каждом cold start на Vercel. В production не работает.

```bash
npm install @upstash/redis @upstash/ratelimit --legacy-peer-deps
```

```env
# .env.local + Vercel Dashboard → Environment Variables
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token_here
```

```ts
// src/lib/rate-limit.ts — ПОЛНАЯ ЗАМЕНА файла
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const mutationLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 m'),
  prefix: 'rl:mutation',
})

const createLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  prefix: 'rl:create',
})

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
}

export async function rateLimitMutation(userId: string, action: string): Promise<RateLimitResult> {
  const { success, remaining, reset } = await mutationLimiter.limit(`${userId}:${action}`)
  return { success, remaining, resetAt: reset }
}

export async function rateLimitCreate(userId: string, entity: string): Promise<RateLimitResult> {
  const { success, remaining, reset } = await createLimiter.limit(`${userId}:${entity}`)
  return { success, remaining, resetAt: reset }
}

export async function rateLimitSearch(userId: string): Promise<RateLimitResult> {
  return rateLimitMutation(userId, 'search')
}
```

> ⚠️ **Важно:** функции теперь async. Обновить все call sites:  
> `const rl = rateLimitCreate(...)` → `const rl = await rateLimitCreate(...)`  
> Найти все: `grep -rn "rateLimitCreate\|rateLimitMutation\|rateLimitSearch" src/`

Добавить в `src/lib/env.ts`:
```ts
upstashRedisUrl:   requireEnv('UPSTASH_REDIS_REST_URL'),
upstashRedisToken: requireEnv('UPSTASH_REDIS_REST_TOKEN'),
```

---

### 0.4 GitHub Actions CI Pipeline

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci --legacy-peer-deps

      - name: Type check
        run: npx tsc --noEmit

      - name: Run tests
        run: npm test
        env:
          NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co'
          NEXT_PUBLIC_SUPABASE_ANON_KEY: 'placeholder'

      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co'
          NEXT_PUBLIC_SUPABASE_ANON_KEY: 'placeholder'
          UPSTASH_REDIS_REST_URL: 'https://placeholder.upstash.io'
          UPSTASH_REDIS_REST_TOKEN: 'placeholder'
```

### ✅ Чеклист Phase 0

- [ ] `src/types/supabase.ts` сгенерирован, `Database = any` убран
- [ ] `middleware.ts` в корне проекта
- [ ] Upstash Redis создан, env переменные добавлены в .env.local и Vercel
- [ ] `rate-limit.ts` заменён, все call sites обновлены с `await`
- [ ] `.github/workflows/ci.yml` создан, первый run зелёный
- [ ] `npm test` + `npm run build` — зелёные
- [ ] git commit + git push

---

## PHASE 1 — Multi-tenant Foundation (3–4 недели)

**Самая важная фаза.** Без неё продать продукт второму агентству невозможно.

### 1.1 Таблицы organizations и organization_members

Применить через **Supabase:apply_migration** с именем `create_organizations`:

```sql
CREATE TABLE IF NOT EXISTS organizations (
  id                     uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  name                   text    NOT NULL,
  slug                   text    UNIQUE NOT NULL,
  plan                   text    NOT NULL DEFAULT 'free'
                                 CHECK (plan IN ('free', 'pro', 'enterprise')),
  stripe_customer_id     text,
  stripe_subscription_id text,
  subscription_status    text    DEFAULT 'inactive',
  trial_ends_at          timestamptz,
  is_active              boolean NOT NULL DEFAULT true,
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organization_members (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            text NOT NULL DEFAULT 'agent'
                       CHECK (role IN ('admin', 'manager', 'agent', 'accountant')),
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organizations_slug  ON organizations(slug);

ALTER TABLE organizations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE policyname = 'Members can view their org' AND tablename = 'organizations') THEN
    CREATE POLICY "Members can view their org" ON organizations FOR SELECT TO authenticated
      USING (id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND is_active = true
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE policyname = 'Members can view org membership' AND tablename = 'organization_members') THEN
    CREATE POLICY "Members can view org membership" ON organization_members FOR SELECT TO authenticated
      USING (organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
      ));
  END IF;
END $$;
```

Применить через **Supabase:apply_migration** с именем `create_org_helper_function`:

```sql
-- Helper: получить org_id текущего пользователя (используется во всех RLS)
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT organization_id
  FROM organization_members
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1
$$;
```

---

### 1.2 Миграция: добавить org_id на все таблицы

Применить через **Supabase:apply_migration** с именем `add_org_id_to_all_tables`:

```sql
-- Шаг 1: организация по умолчанию для существующих данных
INSERT INTO organizations (id, name, slug, plan) VALUES (
  '00000000-0000-0000-0000-000000000001', 'HousePro', 'housepro', 'pro'
) ON CONFLICT (slug) DO NOTHING;

-- Шаг 2: существующие users → organization_members
INSERT INTO organization_members (organization_id, user_id, role)
SELECT '00000000-0000-0000-0000-000000000001', u.id, u.role
FROM users u
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Шаг 3: добавить org_id (nullable сначала)
ALTER TABLE contacts   ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);
ALTER TABLE leads      ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);
ALTER TABLE deals      ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);
ALTER TABLE contracts  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);
ALTER TABLE payments   ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);
ALTER TABLE tasks      ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);
ALTER TABLE files      ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);
ALTER TABLE users      ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);
ALTER TABLE notifications             ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);
ALTER TABLE accounting_transactions   ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);
ALTER TABLE accounting_categories     ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);
ALTER TABLE accounting_recurring_rules ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);
ALTER TABLE company_settings          ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);
ALTER TABLE document_templates        ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);

-- Шаг 4: заполнить org_id для существующих данных
UPDATE contacts   SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE leads      SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE deals      SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE properties SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE contracts  SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE payments   SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE tasks      SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE files      SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE users      SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE notifications             SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE accounting_transactions   SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE accounting_categories     SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE accounting_recurring_rules SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE company_settings          SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE document_templates        SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;

-- Шаг 5: NOT NULL constraint
ALTER TABLE contacts   ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE leads      ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE deals      ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE properties ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE contracts  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE tasks      ALTER COLUMN organization_id SET NOT NULL;

-- Шаг 6: индексы (КРИТИЧНО для производительности)
CREATE INDEX IF NOT EXISTS idx_contacts_org_id    ON contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_leads_org_id       ON leads(organization_id);
CREATE INDEX IF NOT EXISTS idx_deals_org_id       ON deals(organization_id);
CREATE INDEX IF NOT EXISTS idx_properties_org_id  ON properties(organization_id);
CREATE INDEX IF NOT EXISTS idx_contracts_org_id   ON contracts(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_org_id       ON tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_accounting_org_id  ON accounting_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_org_id ON notifications(organization_id);
```

---

### 1.3 JWT Hook — org_id в токен

Создать Edge Function в Supabase Dashboard → Authentication → Hooks → **Customize access token**:

```ts
// supabase/functions/custom-access-token/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const payload = await req.json()
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  const { data: membership } = await supabaseAdmin
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', payload.user_id)
    .eq('is_active', true)
    .single()

  return new Response(
    JSON.stringify({
      claims: {
        ...payload.claims,
        org_id:   membership?.organization_id ?? null,
        org_role: membership?.role ?? null,
      }
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
```

Создать helper для получения org_id в Server Actions:

```ts
// src/lib/org.ts — новый файл
import { createClient } from '@/lib/supabase/server'

export async function getOrgId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const orgId = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))?.org_id
    : null
  return orgId ?? null
}

export async function requireOrgId(): Promise<string> {
  const orgId = await getOrgId()
  if (!orgId) throw new Error('Organization not found')
  return orgId
}
```

---

### 1.4 Переписать RLS политики с org_id изоляцией

Применить через **Supabase:apply_migration** с именем `rewrite_rls_with_org_isolation`.

Шаблон для каждой таблицы (повторить для: contacts, leads, deals, properties, contracts, payments, tasks, accounting_transactions, accounting_categories, notifications, files, company_settings, document_templates):

```sql
-- Пример для contacts (повторить для каждой таблицы)
DROP POLICY IF EXISTS "Authenticated users can view contacts" ON contacts;
DROP POLICY IF EXISTS "Authenticated users can insert contacts" ON contacts;
DROP POLICY IF EXISTS "Authenticated users can update contacts" ON contacts;
DROP POLICY IF EXISTS "Authenticated users can delete contacts" ON contacts;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE policyname = 'org members can view contacts' AND tablename = 'contacts') THEN
    CREATE POLICY "org members can view contacts" ON contacts FOR SELECT TO authenticated
      USING (organization_id = get_user_org_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE policyname = 'org members can insert contacts' AND tablename = 'contacts') THEN
    CREATE POLICY "org members can insert contacts" ON contacts FOR INSERT TO authenticated
      WITH CHECK (organization_id = get_user_org_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE policyname = 'org members can update contacts' AND tablename = 'contacts') THEN
    CREATE POLICY "org members can update contacts" ON contacts FOR UPDATE TO authenticated
      USING      (organization_id = get_user_org_id())
      WITH CHECK (organization_id = get_user_org_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE policyname = 'org admins can delete contacts' AND tablename = 'contacts') THEN
    CREATE POLICY "org admins can delete contacts" ON contacts FOR DELETE TO authenticated
      USING (organization_id = get_user_org_id());
  END IF;
END $$;
```

---

### 1.5 Обновление Server Actions — добавить org_id

Паттерн для всех actions (contacts, leads, deals, properties, contracts, accounting, tasks, files):

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { requireOrgId } from '@/lib/org'   // ← ДОБАВИТЬ ИМПОРТ
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createContactAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  // ← ДОБАВИТЬ: получаем org_id
  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const rl = await rateLimitCreate(user.id, 'contact')  // ← await!
  if (!rl.success) return { error: 'Слишком много запросов' }

  const parsed = ContactSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { data, error } = await supabase
    .from('contacts')
    .insert({
      ...parsed.data,
      organization_id: orgId,  // ← ДОБАВИТЬ в каждый .insert()
      created_by: user.id,
    })
    .select().single()

  if (error) return { error: error.message }

  revalidatePath('/contacts')
  redirect(`/contacts/${data.id}`)
}
```

---

### 1.6 Обновить TypeScript типы

Добавить в `src/types/database.ts`:

```ts
export interface Organization {
  id: string
  name: string
  slug: string
  plan: 'free' | 'pro' | 'enterprise'
  stripe_customer_id?: string
  stripe_subscription_id?: string
  subscription_status?: string
  trial_ends_at?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface OrganizationMember {
  organization_id: string
  user_id: string
  role: UserRole
  is_active: boolean
  created_at: string
  organization?: Organization
  user?: User
}
```

Добавить `organization_id: string` в интерфейсы: `Contact`, `Lead`, `Deal`, `Property`, `Contract`, `Task`, `AccountingTransaction`.

После изменений БД: `npm run db:types`

---

### 1.7 Удаление legacy таблиц

> ⚠️ Сначала проверить: `grep -rn "from('clients')\|from('owners')" src/`

Применить через **Supabase:apply_migration** с именем `drop_legacy_tables`:

```sql
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_name = 'clients' AND table_schema = 'public') THEN
    DROP TABLE clients CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_name = 'owners' AND table_schema = 'public') THEN
    DROP TABLE owners CASCADE;
  END IF;
END $$;
```

Убрать интерфейсы `Client` и `Owner` из `src/types/database.ts`.

### ✅ Чеклист Phase 1

- [ ] `organizations` + `organization_members` таблицы созданы
- [ ] `get_user_org_id()` helper функция создана в БД
- [ ] `org_id` добавлен на все таблицы, `NOT NULL` установлен
- [ ] Все существующие данные обновлены с `org_id` дефолтной организации
- [ ] Индексы на `org_id` созданы для всех таблиц
- [ ] JWT hook создан и добавляет `org_id` в access token
- [ ] RLS политики переписаны с `get_user_org_id()`
- [ ] Все Server Actions обновлены — добавляют `organization_id` при insert
- [ ] `src/lib/org.ts` создан с `getOrgId()` / `requireOrgId()`
- [ ] TypeScript типы обновлены, `npm run db:types` выполнен
- [ ] Legacy таблицы `clients` + `owners` удалены
- [ ] Проверено вручную: два тестовых агентства не видят данные друг друга
- [ ] `npm test` + `npm run build` — зелёные

---

## PHASE 2 — Security & Audit (1–2 недели)

### 2.1 Audit Log

Применить через **Supabase:apply_migration** с именем `setup_audit_log`:

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id),
  action          text NOT NULL,   -- 'create' | 'update' | 'delete'
  entity_type     text NOT NULL,   -- 'contact' | 'deal' | 'contract' | ...
  entity_id       uuid,
  entity_label    text,
  changes         jsonb,           -- { field: { old: val, new: val } }
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id
  ON audit_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON audit_logs(entity_type, entity_id);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE policyname = 'org members can view audit logs' AND tablename = 'audit_logs') THEN
    CREATE POLICY "org members can view audit logs" ON audit_logs FOR SELECT TO authenticated
      USING (organization_id = get_user_org_id());
  END IF;
END $$;
```

Создать `src/lib/audit.ts`:

```ts
import { createClient } from '@/lib/supabase/server'

interface AuditParams {
  userId:      string
  orgId:       string
  action:      'create' | 'update' | 'delete'
  entityType:  string
  entityId:    string
  entityLabel: string
  changes?:    Record<string, { old: unknown; new: unknown }>
}

export async function writeAuditLog(params: AuditParams): Promise<void> {
  try {
    const supabase = await createClient()
    await supabase.from('audit_logs').insert({
      organization_id: params.orgId,
      user_id:         params.userId,
      action:          params.action,
      entity_type:     params.entityType,
      entity_id:       params.entityId,
      entity_label:    params.entityLabel,
      changes:         params.changes ?? null,
    })
  } catch (e) {
    // Audit не должен ломать основной флоу
    console.error('Audit log error:', e)
  }
}
```

Добавить `writeAuditLog(...)` в key Server Actions после успешного insert/update/delete.  
Создать страницу `/settings/audit/page.tsx` (только для admin роли).

---

### 2.2 Версионирование договоров — UI

Таблица `contract_versions` уже существует в БД — нужно только write path и UI:

```ts
// В updateContractAction — перед update сохранить текущую версию:
const { data: current } = await supabase
  .from('contracts').select('*').eq('id', id).single()

if (current) {
  await supabase.from('contract_versions').insert({
    contract_id:     id,
    organization_id: orgId,
    version_data:    current,
    created_by:      user.id,
    created_at:      new Date().toISOString(),
  })
}
```

Создать `src/features/contracts/components/ContractVersionHistory.tsx` — список версий с датой, автором, кнопкой "Восстановить". Встроить в `contracts/[id]/page.tsx`.

---

### 2.3 Role permissions matrix

```ts
// src/lib/permissions.ts — новый файл
import type { UserRole } from '@/types/database'

type Resource = 'contacts' | 'deals' | 'leads' | 'properties'
              | 'contracts' | 'payments' | 'employees' | 'accounting'
              | 'analytics' | 'settings'

type Action = 'read' | 'create' | 'update' | 'delete' | 'export'

const PERMISSIONS: Record<UserRole, Partial<Record<Resource, Action[]>>> = {
  admin: {
    contacts:   ['read', 'create', 'update', 'delete', 'export'],
    deals:      ['read', 'create', 'update', 'delete'],
    contracts:  ['read', 'create', 'update', 'delete'],
    employees:  ['read', 'create', 'update', 'delete'],
    accounting: ['read', 'create', 'update', 'delete', 'export'],
    settings:   ['read', 'update'],
    analytics:  ['read', 'export'],
    leads:      ['read', 'create', 'update', 'delete'],
    properties: ['read', 'create', 'update', 'delete'],
    payments:   ['read', 'create', 'update', 'delete'],
  },
  manager: {
    contacts:   ['read', 'create', 'update'],
    deals:      ['read', 'create', 'update'],
    contracts:  ['read', 'create', 'update'],
    employees:  ['read'],
    accounting: ['read'],
    analytics:  ['read'],
    leads:      ['read', 'create', 'update'],
    properties: ['read', 'create', 'update'],
    payments:   ['read', 'create'],
    settings:   ['read'],
  },
  agent: {
    contacts:   ['read', 'create', 'update'],
    deals:      ['read', 'create', 'update'],
    leads:      ['read', 'create', 'update'],
    properties: ['read'],
    contracts:  ['read'],
  },
  accountant: {
    accounting: ['read', 'create', 'update', 'export'],
    deals:      ['read'],
    contracts:  ['read'],
    payments:   ['read', 'create', 'update'],
    analytics:  ['read'],
  },
}

export function can(role: UserRole, resource: Resource, action: Action): boolean {
  return PERMISSIONS[role]?.[resource]?.includes(action) ?? false
}
```

### ✅ Чеклист Phase 2

- [ ] `audit_logs` таблица создана с `org_id`
- [ ] `src/lib/audit.ts` создан, `writeAuditLog` вызывается в key actions
- [ ] Страница `/settings/audit` создана (только для admin)
- [ ] Версии договоров сохраняются при update, `ContractVersionHistory` встроен
- [ ] `src/lib/permissions.ts` создан, `can()` используется в Server Actions

---

## PHASE 3 — PropTech Features (3–4 недели)

### 3.1 Модуль показов (Showings)

Применить через **Supabase:apply_migration** с именем `create_showings`:

```sql
CREATE TABLE IF NOT EXISTS showings (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id     uuid REFERENCES properties(id) ON DELETE SET NULL,
  lead_id         uuid REFERENCES leads(id)      ON DELETE SET NULL,
  deal_id         uuid REFERENCES deals(id)      ON DELETE SET NULL,
  contact_id      uuid REFERENCES contacts(id)   ON DELETE SET NULL,
  agent_id        uuid REFERENCES auth.users(id),
  scheduled_at    timestamptz NOT NULL,
  duration_min    integer DEFAULT 30,
  status          text NOT NULL DEFAULT 'planned'
                       CHECK (status IN ('planned', 'completed', 'cancelled', 'no_show')),
  result          text,   -- 'interested' | 'not_interested' | 'thinking'
  feedback        text,
  next_step       text,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_showings_org_id    ON showings(organization_id);
CREATE INDEX IF NOT EXISTS idx_showings_property  ON showings(property_id);
CREATE INDEX IF NOT EXISTS idx_showings_agent_date ON showings(agent_id, scheduled_at);

ALTER TABLE showings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE policyname = 'org showings access' AND tablename = 'showings') THEN
    CREATE POLICY "org showings access" ON showings FOR ALL TO authenticated
      USING      (organization_id = get_user_org_id())
      WITH CHECK (organization_id = get_user_org_id());
  END IF;
END $$;
```

Файловая структура модуля:

| Файл | Тип | Что делает |
|------|-----|-----------|
| `src/app/(dashboard)/showings/page.tsx` | Server | Список показов с фильтрами |
| `src/app/(dashboard)/showings/new/page.tsx` | Server | Форма создания |
| `src/app/(dashboard)/showings/[id]/page.tsx` | Server | Детали показа |
| `src/features/showings/actions/showings.actions.ts` | Actions | CRUD + смена статуса |
| `src/features/showings/components/ShowingStatusBadge.tsx` | Client | Бейдж статуса |
| `src/features/showings/components/ShowingResultForm.tsx` | Client | Форма результата |

Добавить ссылку в Sidebar между Properties и Contracts.

---

### 3.2 Подборки объектов (Property Collections)

Применить через **Supabase:apply_migration** с именем `create_property_collections`:

```sql
CREATE TABLE IF NOT EXISTS property_collections (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id         uuid REFERENCES leads(id) ON DELETE CASCADE,
  title           text NOT NULL,
  share_token     text UNIQUE DEFAULT encode(gen_random_bytes(12), 'hex'),
  is_public       boolean DEFAULT false,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS collection_items (
  collection_id uuid NOT NULL REFERENCES property_collections(id) ON DELETE CASCADE,
  property_id   uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  sort_order    integer DEFAULT 0,
  agent_note    text,
  added_at      timestamptz DEFAULT now(),
  PRIMARY KEY (collection_id, property_id)
);
```

Создать публичную страницу подборки (без auth): `src/app/c/[token]/page.tsx`.  
Добавить `/c/` в `PUBLIC_PATHS` в `middleware.ts`.

---

### 3.3 Email уведомления (Resend)

```bash
npm install resend --legacy-peer-deps
```

```env
RESEND_API_KEY=re_your_key_here
NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app
```

```ts
// src/lib/email.ts — новый файл
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'HousePro CRM <noreply@your-domain.ru>'

export async function sendPaymentOverdueEmail(params: {
  to: string; agentName: string; amount: number; dueDate: string; contractNumber?: string
}) {
  await resend.emails.send({
    from: FROM, to: [params.to],
    subject: `⚠️ Просроченный платёж — ${params.contractNumber ?? ''}`,
    html: `<p>Платёж ${params.amount.toLocaleString('ru')} ₽ просрочен (ожидался ${params.dueDate})</p>`,
  })
}

// Аналогично создать:
// sendContractExpiryEmail()
// sendNewLeadAssignedEmail()
// sendTaskOverdueEmail()
```

---

### 3.4 KPI Dashboard сотрудников

Обновить `src/app/(dashboard)/employees/[id]/page.tsx` — добавить блок статистики:

```ts
// Добавить в Promise.all:
const [{ count: dealsCount }, { count: completedCount }, { data: dealStats }] = await Promise.all([
  supabase.from('deals').select('id', { count: 'exact', head: true })
    .eq('manager_id', employeeId).gte('created_at', monthStart),
  supabase.from('deals').select('id', { count: 'exact', head: true })
    .eq('manager_id', employeeId).eq('status', 'completed').gte('created_at', monthStart),
  supabase.from('deals').select('commission, amount')
    .eq('manager_id', employeeId).eq('status', 'completed'),
])

const totalCommission = (dealStats ?? []).reduce((s, d) => s + Number(d.commission ?? 0), 0)
```

Отображать в 4 stat-карточках по визуальному стандарту CLAUDE.md: Сделки за месяц, Завершено, Конверсия, Комиссия.

---

### 3.5 Расширенная аналитика — кастомный период

Создать `src/features/analytics/components/DateRangePicker.tsx` — Client Component с `input[type=date]` from/to. При изменении обновлять `searchParams` через `useRouter().push`.

В `src/app/(dashboard)/analytics/page.tsx` читать `searchParams.from` и `searchParams.to` для фильтрации запросов.

### ✅ Чеклист Phase 3

- [ ] `showings` таблица создана, модуль `/showings` работает (CRUD + смена статуса)
- [ ] `property_collections` + `collection_items` созданы, `/c/[token]` публичная страница
- [ ] Resend установлен, email уведомления работают для просроченных платежей
- [ ] KPI блок добавлен на страницу сотрудника
- [ ] Аналитика поддерживает произвольный период через `searchParams`
- [ ] `npm test` + `npm run build` — зелёные

---

## PHASE 4 — SaaS Core (4–6 недель)

### 4.1 Stripe Billing

```bash
npm install stripe @stripe/stripe-js --legacy-peer-deps
```

```env
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Добавить в `src/lib/env.ts`:
```ts
stripeSecretKey:     requireEnv('STRIPE_SECRET_KEY'),
stripeWebhookSecret: requireEnv('STRIPE_WEBHOOK_SECRET'),
```

Создать API routes:

| Файл | Endpoint | Описание |
|------|---------|---------|
| `src/app/api/billing/checkout/route.ts` | POST | Создать Stripe Checkout Session |
| `src/app/api/billing/portal/route.ts` | POST | Создать Stripe Customer Portal |
| `src/app/api/stripe/webhook/route.ts` | POST | Обработать Stripe webhooks |

```ts
// src/app/api/stripe/webhook/route.ts — ключевая логика
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers()
  const sig = headersList.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    return new Response(`Webhook error: ${err}`, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  switch (event.type) {
    case 'customer.subscription.updated':
    case 'customer.subscription.created': {
      const sub = event.data.object as Stripe.Subscription
      const plan = sub.items.data[0]?.price?.lookup_key ?? 'free'
      await supabase.from('organizations')
        .update({ plan, subscription_status: sub.status, stripe_subscription_id: sub.id })
        .eq('stripe_customer_id', sub.customer as string)
      break
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await supabase.from('organizations')
        .update({ plan: 'free', subscription_status: 'cancelled' })
        .eq('stripe_customer_id', sub.customer as string)
      break
    }
  }

  return new Response('OK')
}
```

```ts
// src/lib/feature-gates.ts — новый файл
const PLAN_LIMITS = {
  free:       { max_users: 1,        max_properties: 20,       max_contracts: 10,       api_access: false, webhooks: false },
  pro:        { max_users: 10,       max_properties: Infinity, max_contracts: Infinity, api_access: true,  webhooks: false },
  enterprise: { max_users: Infinity, max_properties: Infinity, max_contracts: Infinity, api_access: true,  webhooks: true  },
} as const

export function getFeatureGate(plan: string) {
  return PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] ?? PLAN_LIMITS.free
}
```

Создать страницу `/settings/billing/page.tsx` с тарифами и кнопками апгрейда.

---

### 4.2 Onboarding Wizard

Создать `src/app/(dashboard)/onboarding/page.tsx` — 5-шаговый wizard:

| Шаг | Что делаем | Таблица |
|-----|-----------|---------|
| 1. Компания | Название + ИНН + телефон | organizations |
| 2. Профиль исполнителя | Юридическая форма + реквизиты | company_settings |
| 3. Первый объект | Быстрое добавление | properties |
| 4. Первый лид | Добавить тестовый лид | leads |
| 5. Шаблоны | Ссылка на загрузку DOCX шаблонов | document_templates |

Добавить поле `onboarding_completed boolean DEFAULT false` в `organizations`.  
В `(dashboard)/layout.tsx` — если `!onboarding_completed` → редиректить на `/onboarding`.

---

### 4.3 PWA Manifest

```json
// public/manifest.json
{
  "name": "HousePro CRM",
  "short_name": "HousePro",
  "description": "CRM для агентств недвижимости",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#F8FAFC",
  "theme_color": "#16A34A",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

```ts
// src/app/layout.tsx — добавить в metadata:
export const metadata: Metadata = {
  // ... существующие поля
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'HousePro CRM' },
}
```

### ✅ Чеклист Phase 4

- [ ] Stripe установлен, `/api/billing/checkout` и `/api/stripe/webhook` работают
- [ ] Webhook обновляет `organizations.plan` при оплате/отмене
- [ ] Страница `/settings/billing` с тарифами создана
- [ ] Feature gates работают — free план ограничен 20 объектами
- [ ] Onboarding wizard создан, новые агентства проходят его при первом входе
- [ ] `manifest.json` + иконки добавлены
- [ ] `npm test` + `npm run build` — зелёные

---

## PHASE 5 — API & Integrations (4–6 недель)

### 5.1 Public REST API

Применить через **Supabase:apply_migration** с именем `create_api_keys`:

```sql
CREATE TABLE IF NOT EXISTS api_keys (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  key_hash        text NOT NULL UNIQUE,
  key_prefix      text NOT NULL,
  scopes          text[] NOT NULL DEFAULT '{read}',
  last_used_at    timestamptz,
  expires_at      timestamptz,
  is_active       boolean DEFAULT true,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
```

```ts
// src/lib/api-auth.ts — новый файл
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function authenticateApiKey(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer hp_'))
    return { error: 'Invalid API key format', status: 401 }

  const apiKey  = authHeader.replace('Bearer ', '')
  const keyHash = createHash('sha256').update(apiKey).digest('hex')

  const { data: key } = await supabaseAdmin
    .from('api_keys')
    .select('organization_id, scopes, is_active, expires_at')
    .eq('key_hash', keyHash)
    .single()

  if (!key || !key.is_active) return { error: 'Invalid API key', status: 401 }
  if (key.expires_at && new Date(key.expires_at) < new Date())
    return { error: 'API key expired', status: 401 }

  await supabaseAdmin.from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('key_hash', keyHash)

  return { orgId: key.organization_id, scopes: key.scopes }
}
```

API endpoints создать в `src/app/api/v1/`:

| Endpoint | Описание |
|---------|---------|
| `GET/POST /api/v1/contacts` | Список + создание контактов |
| `GET/PUT/DELETE /api/v1/contacts/[id]` | CRUD одного контакта |
| `GET/POST /api/v1/leads` | Лиды |
| `GET /api/v1/properties` | Объекты (read-only) |
| `GET /api/v1/deals` | Сделки (read-only) |

Добавить исключение в `middleware.ts` для `/api/v1`.  
Создать страницу управления ключами: `/settings/api/page.tsx`.

---

### 5.2 Webhooks

Применить через **Supabase:apply_migration** с именем `create_webhooks`:

```sql
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  url             text NOT NULL,
  secret          text NOT NULL,
  events          text[] NOT NULL DEFAULT '{}',
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);
```

```ts
// src/lib/webhooks.ts — новый файл
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'

export async function dispatchWebhook(orgId: string, event: string, payload: Record<string, unknown>) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: endpoints } = await supabase
    .from('webhook_endpoints')
    .select('url, secret')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .contains('events', [event])

  if (!endpoints?.length) return

  const body = JSON.stringify({ event, data: payload, timestamp: Date.now() })

  await Promise.allSettled(
    endpoints.map(async (ep) => {
      const sig = createHmac('sha256', ep.secret).update(body).digest('hex')
      await fetch(ep.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-HousePro-Signature': `sha256=${sig}` },
        body,
        signal: AbortSignal.timeout(5000),
      })
    })
  )
}

// Использование в createLeadAction:
// await dispatchWebhook(orgId, 'lead.created', { id: lead.id, ... })
```

---

### 5.3 Экспорт 1С / CSV

```ts
// Паттерн экспорта в src/app/api/export/contacts/route.ts
const BOM = '\uFEFF'
const csvHeaders = ['ФИО/Название', 'Телефон', 'Email', 'ИНН', 'КПП', 'ОГРН', 'Роль']
const rows = contacts.map(c => [
  c.company_name || c.full_name,
  c.phone ?? '', c.email ?? '',
  c.inn ?? '', c.kpp ?? '', c.ogrn ?? '',
  c.role
])
const csv = BOM + [csvHeaders, ...rows].map(r => r.join(';')).join('\n')

return new Response(csv, {
  headers: {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="contacts.csv"',
  }
})
```

Аналогично создать для: `deals`, `contracts`, `accounting_transactions`.

### ✅ Чеклист Phase 5

- [ ] `api_keys` таблица создана, `authenticateApiKey` работает
- [ ] API endpoints `/api/v1/*` созданы и возвращают данные по org
- [ ] Страница управления API ключами `/settings/api` создана
- [ ] `webhook_endpoints` таблица создана, `dispatchWebhook` вызывается из key actions
- [ ] CSV экспорт с BOM добавлен для contacts, deals, contracts
- [ ] `npm test` + `npm run build` — зелёные

---

## После выполнения всех фаз

Продукт полностью SaaS-готов. Останется только:

- **Ценообразование** — определить стоимость Free/Pro/Enterprise для рынка РФ
- **Лендинг** — сайт-витрина с описанием и кнопкой регистрации  
- **Go-to-market** — партнёрства с риелторскими ассоциациями

> **Правило порядка фаз:** Phase 0 → 1 → 2 → 3 → 4 → 5.  
> После Phase 4 можно принимать первых платящих клиентов, Phase 5 выполнять параллельно.

