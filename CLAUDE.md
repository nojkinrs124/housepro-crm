# HousePro CRM — Инструкция для Claude

Этот файл — главное руководство для работы с проектом. Читай его ПОЛНОСТЬЮ перед любой задачей.

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

## 🎨 ВИЗУАЛЬНЫЙ СТАНДАРТ — ОБЯЗАТЕЛЕН ДЛЯ ВСЕХ НОВЫХ СТРАНИЦ И КОМПОНЕНТОВ

> **Правило**: при создании любой новой страницы, формы, карточки или компонента — строго следовать этому разделу. Отклонения от стандарта не допускаются.

---

### Цветовая палитра и токены

```tsx
// ✅ ВСЕГДА использовать эти значения напрямую (хардкодом через inline style или Tailwind arbitrary)
// НЕ использовать bg-primary, text-foreground, bg-card и другие shadcn-токены
// в новом коде — они существуют в legacy-коде, их не трогать, но в новом не писать

// Основные цвета
'#111827'   // text — основной тёмный текст
'#64748B'   // text secondary — подписи, лейблы
'#94A3B8'   // text tertiary — плейсхолдеры, неактивное
'#F8FAFC'   // background страницы
'#FFFFFF'   // background карточек
'#16A34A'   // brand green primary
'#22C55E'   // brand green lighter

// Границы и тени
'rgba(214,219,235,0.7)'  // border карточек
'0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)'   // shadow-sm карточек
'0 4px 16px rgba(0,0,0,0.06), 0 12px 40px rgba(0,0,0,0.08)' // shadow-md hover

// Градиент CTA-кнопки (зелёная)
'linear-gradient(135deg, #16A34A, #22C55E)'
'0 4px 16px rgba(22,163,74,0.35)'  // boxShadow для CTA-кнопки
```

---

### Карточки-контейнеры

**Стандартная карточка:**
```tsx
<div
  className="bg-white rounded-[20px] border border-slate-100 p-5"
  style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}
>
  ...
</div>
```

**Карточки в grid-строке (выровнять по высоте):**
```tsx
// На родительском grid
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Карточки должны иметь h-full flex flex-col для равной высоты строки */}
  <div className="bg-white rounded-[20px] border border-slate-100 p-5 h-full flex flex-col"
    style={{ boxShadow: '...' }}>
    ...
  </div>
</div>
```

**Правила карточек:**
- Радиус: всегда `rounded-[20px]`
- Padding: `p-5` (стандарт) — одинаково на всех страницах
- Border: `border border-slate-100`
- Shadow: всегда через inline `style` (Tailwind не умеет точные значения)
- Вложенные карточки (секции внутри формы): `rounded-[20px]` тоже
- Заголовок секции внутри карточки: `font-bold text-[#111827] text-[15px]`

---

### Заголовки страниц (H1)

```tsx
// ✅ ЕДИНСТВЕННЫЙ допустимый стандарт для главного заголовка страницы
<h1 className="text-[28px] font-bold text-[#111827] tracking-tight leading-tight">
  Название страницы
</h1>

// Подзаголовок/описание под H1
<p className="text-[#64748B] mt-1.5 text-sm font-medium">
  Описание или количество записей
</p>

// Заголовок секции внутри карточки (H2)
<h2 className="font-bold text-[#111827] text-[15px]">
  Название секции
</h2>
```

---

### CTA-кнопки (главные действия — Создать, Сохранить, Добавить)

```tsx
// ✅ СТАНДАРТ: всегда градиент + inline style (Tailwind не поддерживает градиент)
<button
  type="submit"
  className="flex items-center gap-2 px-5 py-2.5 text-white rounded-[14px] text-sm font-bold hover:-translate-y-0.5 transition-all"
  style={{
    background: 'linear-gradient(135deg, #16A34A, #22C55E)',
    boxShadow: '0 4px 16px rgba(22,163,74,0.35)'
  }}
>
  <Plus className="w-4 h-4" />
  Создать
</button>

// Link-версия CTA (для href)
<Link
  href="/module/new"
  className="flex items-center gap-2 px-5 py-2.5 text-white rounded-[14px] text-sm font-bold hover:-translate-y-0.5 transition-all"
  style={{
    background: 'linear-gradient(135deg, #16A34A, #22C55E)',
    boxShadow: '0 4px 16px rgba(22,163,74,0.35)'
  }}
>
  <Plus className="w-4 h-4" />
  Добавить
</Link>
```

**Вторичная кнопка (Отмена, Назад, Редактировать):**
```tsx
<Link
  href="/module"
  className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-[14px] text-sm font-semibold text-[#374151] hover:bg-slate-50 hover:border-slate-300 transition-all"
>
  Отмена
</Link>
```

---

### Поля форм (input, select, textarea)

**ЕДИНСТВЕННЫЙ допустимый стандарт для всех полей:**

```tsx
// Лейбл
<label className="block text-sm font-semibold text-[#111827] mb-1.5">
  Название поля
</label>

// Input
<input
  type="text"
  name="field"
  placeholder="Подсказка"
  className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
/>

// Select
<select
  name="field"
  className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer transition-all"
>
  <option value="">— выберите —</option>
</select>

// Textarea
<textarea
  name="field"
  rows={3}
  placeholder="Подсказка"
  className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none"
/>

// Date input (min-width важен для iOS Safari)
<input
  type="date"
  name="field"
  className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
/>
```

**Правила полей:**
- Высота: `h-10` (40px) для input и select — жёстко везде
- Padding: `px-4` — жёстко везде (не px-3!)
- Радиус: `rounded-xl` (12px) для полей, `rounded-[14px]` для кнопок
- Граница: `border border-input`
- Фокус: `focus:ring-2 focus:ring-primary/30` — везде
- Переход: `transition-all` — везде
- Select: всегда `cursor-pointer`

---

### Структура страницы-списка (list page)

```tsx
export default async function ModulePage() {
  return (
    <div className="space-y-6">

      {/* 1. Шапка страницы */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-[#111827] tracking-tight leading-tight">
            Название раздела
          </h1>
          <p className="text-[#64748B] mt-1 text-sm font-medium">N записей</p>
        </div>
        <Link href="/module/new" className="flex items-center gap-2 px-5 py-2.5 text-white rounded-[14px] text-sm font-bold hover:-translate-y-0.5 transition-all"
          style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)', boxShadow: '0 4px 16px rgba(22,163,74,0.35)' }}>
          <Plus style={{ width: 16, height: 16 }} />
          Добавить
        </Link>
      </div>

      {/* 2. Stat-карточки (опционально) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(stat => (
          <div key={stat.label} className="bg-white rounded-[20px] border border-slate-200/60 shadow-sm p-5 flex items-center gap-3 sm:gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${stat.iconBg}`}>
              <stat.Icon style={{ width: 20, height: 20 }} />
            </div>
            <div className="min-w-0"> {/* ← ОБЯЗАТЕЛЕН для предотвращения overflow */}
              <p className="text-2xl font-bold text-[#111827]">{stat.value}</p>
              <p className="text-xs text-[#64748B] font-medium mt-0.5 leading-tight break-words">
                {stat.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* 3. Основная таблица/список */}
      <div className="bg-white rounded-[20px] border border-slate-100 overflow-hidden"
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}>
        {!items?.length ? (
          /* Empty state */
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-[20px] flex items-center justify-center mx-auto mb-4"
              style={{ background: 'linear-gradient(135deg, rgba(22,163,74,0.1), rgba(34,197,94,0.1))' }}>
              <Icon style={{ width: 24, height: 24, color: '#16A34A' }} />
            </div>
            <p className="text-[#111827] font-bold text-base">Записей ещё нет</p>
            <p className="text-[#64748B] text-sm mt-1">Добавьте первую запись</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map(item => (
              <Link key={item.id} href={`/module/${item.id}`}
                className="flex items-center gap-4 px-6 py-4 hover:bg-[#F8FAFC] transition-all duration-200 group">
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

```tsx
export default async function NewModulePage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* 1. Back link */}
      <Link href="/module"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft style={{ width: 16, height: 16 }} />
        Вернуться к разделу
      </Link>

      {/* 2. Заголовок с иконкой */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0 bg-green-50">
          <Icon className="text-[#16A34A]" style={{ width: 20, height: 20 }} />
        </div>
        <div>
          <h1 className="text-[28px] font-bold text-[#111827] tracking-tight leading-tight">
            Новая запись
          </h1>
          <p className="text-[#64748B] text-sm font-medium mt-0.5">Описание</p>
        </div>
      </div>

      {/* 3. Форма с секциями */}
      <form action={createAction}>
        {/* Секция */}
        <div className="bg-white rounded-[20px] border border-slate-100 p-5 space-y-4"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}>
          <h2 className="font-bold text-[#111827] text-[15px]">Основные данные</h2>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-[#111827]">Название *</label>
            <input type="text" name="title"
              className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              placeholder="Введите название" />
          </div>

          {/* Сетка из нескольких полей — ВСЕГДА responsive */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-[#111827]">Поле 1</label>
              <input type="text" name="field1"
                className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-[#111827]">Поле 2</label>
              <input type="text" name="field2"
                className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
            </div>
          </div>
        </div>

        {/* 4. Кнопки действий */}
        <div className="flex items-center gap-3 pt-2">
          <button type="submit"
            className="flex items-center gap-2 px-6 py-2.5 text-white rounded-[14px] text-sm font-bold hover:-translate-y-0.5 transition-all"
            style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)', boxShadow: '0 4px 16px rgba(22,163,74,0.35)' }}>
            Создать
          </button>
          <Link href="/module"
            className="px-6 py-2.5 bg-white border border-slate-200 rounded-[14px] text-sm font-semibold text-[#374151] hover:bg-slate-50 transition-all">
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

```tsx
export default async function ModuleDetailPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* 1. Back link */}
      <Link href="/module"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft style={{ width: 16, height: 16 }} />
        Назад
      </Link>

      {/* 2. Шапка — ОБЯЗАТЕЛЬНО flex-col sm:flex-row (防止 overflow на мобилке) */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0"> {/* ← min-w-0 обязателен */}
          <div className="w-14 h-14 rounded-[20px] bg-green-100 flex items-center justify-center shrink-0">
            <Icon className="w-7 h-7 text-green-600" />
          </div>
          <div className="min-w-0"> {/* ← min-w-0 обязателен */}
            <h1 className="text-[28px] font-bold text-[#111827] tracking-tight leading-tight break-words">
              {item.title}
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-green-100 text-green-700">
                Статус
              </span>
            </div>
          </div>
        </div>
        {/* Кнопки действий — flex-wrap + shrink-0 + whitespace-nowrap */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Link href={`/module/${id}/edit`}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-[14px] text-sm font-medium hover:bg-accent transition whitespace-nowrap">
            <Edit className="w-4 h-4" />
            Редактировать
          </Link>
          <DeleteButton itemId={id} />
        </div>
      </div>

      {/* 3. Секции данных */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-[20px] border border-slate-100 p-5 space-y-4"
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}>
            <h2 className="font-bold text-[#111827] text-[15px]">Основная информация</h2>
            {/* поля */}
          </div>
        </div>
        <div className="space-y-4">
          {/* боковые карточки */}
        </div>
      </div>

    </div>
  )
}
```

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
    <p className="text-2xl font-bold text-[#111827]">{count}</p>
    <p className="text-xs text-[#64748B] font-medium mt-0.5 leading-tight break-words">
      {label}                                  {/* ← break-words ОБЯЗАТЕЛЕН */}
    </p>
  </div>
</div>
```

---

### Иконки в карточках и бейджах

```tsx
// Иконка-бокс (цветной квадрат с иконкой) — стандарт
<div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-green-50">
  <Icon className="text-green-600" style={{ width: 20, height: 20 }} />
</div>

// Аватар-инициал
<div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white text-sm font-bold"
  style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)', boxShadow: '0 2px 8px rgba(22,163,74,0.25)' }}>
  {name?.charAt(0)?.toUpperCase() ?? '?'}
</div>

// Бейдж статуса
<span className="text-xs px-2.5 py-1 rounded-full font-medium bg-green-100 text-green-700 shrink-0 whitespace-nowrap">
  Активный
</span>
```

---

### Анимации — единый стандарт

```tsx
// Hover-подъём карточки
className="... transition-all hover:-translate-y-0.5"

// Hover-подъём CTA-кнопки (уже в стандарте кнопки выше)
className="... hover:-translate-y-0.5 transition-all"

// Transition на интерактивных элементах списка
className="... hover:bg-[#F8FAFC] transition-all duration-200"

// Framer Motion — только для dashboard KPI карточек и Kanban
// Для обычных страниц не использовать — перегружает рендер
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
// Глобальное правило уже в globals.css, но для явности добавлять min-w-0
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

- [ ] H1 — `text-[28px] font-bold text-[#111827] tracking-tight leading-tight`
- [ ] Карточки — `rounded-[20px] border border-slate-100 p-5` + inline shadow
- [ ] CTA-кнопка — градиент через inline `style`, `rounded-[14px]`, `font-bold`
- [ ] Поля форм — `h-10 px-4 rounded-xl border border-input focus:ring-2 focus:ring-primary/30`
- [ ] Сетки — `grid-cols-1 sm:grid-cols-N` (НЕ `grid-cols-N` без breakpoint)
- [ ] Шапка detail — `flex flex-col sm:flex-row sm:justify-between gap-4`
- [ ] Кнопки в шапке — `flex-wrap shrink-0 whitespace-nowrap`
- [ ] Stat-карточки — `min-w-0` + `break-words` на текстовом блоке
- [ ] Back link — `inline-flex items-center gap-2 text-sm font-medium text-muted-foreground`
- [ ] `space-y-6` на корневом div страницы



**После каждой завершённой фазы работы:**

```bash
# 1. ОБЯЗАТЕЛЬНАЯ проверка перед пушем — event handlers в Server Components
python3 -c "
import os, re
for root, dirs, files in os.walk('src/app'):
    for f in files:
        if not f.endswith('.tsx'): continue
        path = os.path.join(root, f)
        content = open(path).read()
        if content.split('\n')[0].strip() == \"'use client'\": continue
        if re.search(r'on(Mouse|Click|Change|Submit|Drag|Drop)\w*\s*=', content):
            print('❌ SERVER COMPONENT WITH HANDLERS:', path)
"
# Если вывод есть — исправить до пуша!

# 2. Коммит и пуш
git add -A
git commit -m "feat: описание что сделано"
git push origin main
```

Без push изменения потеряются при смене сессии. **Без исключений.**

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
