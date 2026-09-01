---
name: housepro-ui
description: Визуальный стандарт HousePro CRM «Кабинет» — палитра-токены, блоки, бейджи, поля форм и готовые шаблоны страниц (список, форма, детальная карточка). Использовать при создании или правке ЛЮБОЙ страницы, формы, карточки или компонента в src/app и src/features, а также когда нужно понять, почему упал линтер визуального стандарта. Триггеры: новая страница, новая форма, вёрстка, стилизация, дизайн, hp-block, hp-badge, hp-input, токены, палитра, адаптивность.
---

# Визуальный стандарт «Кабинет»

Гибрид двух направлений: **1c «Кабинет»** (тёплая шалфейно-моховая палитра, Source
Serif 4 + Source Sans 3, плоские панели) и **1b «Инженерный реестр»** (структура
«блоков»: секция с капс-заголовком и линованными строками лейбл/значение).

**Эталоны в коде** — сверяться с ними, а не выдумывать:
`src/app/(dashboard)/contacts/page.tsx` (список),
`src/app/(dashboard)/contacts/new/page.tsx` (форма),
`src/app/(dashboard)/contacts/[id]/page.tsx` (детальная),
модуль `deals` — реестры и блоки.

**Машинная часть стандарта проверяется автоматически** — `.claude/hooks/post-edit.mjs`
на каждое редактирование и шаг 4/7 в `npm run check`. Линтер работает по baseline:
падает только при росте нарушений в файле. История редизайнов — `docs/DESIGN_SYSTEM_AUDIT.md`.

---

## Токены

Все значения — CSS-переменные в `src/app/globals.css` (`:root`). **Хардкодить хекс
запрещено** — только `var(--hp-*)` через inline `style` или Tailwind arbitrary-класс
`text-[var(--hp-ink)]`.

```
--hp-ink          #232A24   основной текст
--hp-sub          #5C6659   вторичный текст, лейблы, метаданные
--hp-tertiary     #8A9382   плейсхолдеры, неактивное
--hp-bg           #EEF0E9   фон страницы
--hp-surface      #FBFBF8   фон карточек/панелей
--hp-border       #DFE4D6   hairline-граница
--hp-border-soft  #EAEEE2   граница между строками таблицы/блока

--hp-accent       #4B6B46   CTA, активная навигация — ПЛОСКИЙ, без градиента
--hp-accent-hover #3D5A39
--hp-neutral-tint #E4E8DA   нейтральные плашки, иконки-боксы, фон сайдбара
--hp-accent-tint  #DBE1CF   активный пункт меню, выбранный фильтр-чип

--hp-good   / --hp-good-tint     #3D6238 / #E2ECDD   активен, завершено
--hp-warn   / --hp-warn-tint     #7A6B3F / #F0ECDD   VIP, требует внимания
--hp-danger / --hp-danger-tint   #A24B30 / #F3E5E0   просрочено, удаление — только тревожное
--hp-info   / --hp-info-tint     #41546B / #E6EAF0   новое, информационное

--hp-radius        0   карточки, кнопки, инпуты, иконки-боксы, панели
--hp-radius-sm     0   вложенное: строки списка, чипы, плитки
--hp-radius-badge  0   бейджи — прямоугольная метка, не pill
```

**Теней в системе нет вообще.** Форму задаёт `border`, не `box-shadow`.

**Радиус один и равен 0**, аватары квадратные. `rounded-full` — только на точках-статусах,
полосках прогресса и спиннерах. Токены оставлены как единственная точка настройки —
не писать `rounded-[4px]`.

**Шрифты** (подключены в `globals.css`):
- `Source Sans 3` — весь интерфейсный текст.
- `Source Serif 4` — H1/H2/H3 (глобально на теге, класс не нужен), крупные суммы, заголовки секций.
- Моно-шрифта нет: телефоны, даты, суммы — обычным интерфейсным. Исключение, уже
  зафиксированное в baseline, — API-ключи, вебхук-секреты и стектрейсы.
- Не заменять на Public Sans / Archivo / Sora / Work Sans / Karla — **у них нет кириллицы**
  (проверять `fonts.google.com/metadata/fonts` → `subsets`).

---

## Карточка-контейнер

```tsx
<div className="bg-[var(--hp-surface)] rounded-[var(--hp-radius)] border border-[var(--hp-border)] p-5">
```

- padding всегда `p-5`;
- в grid-строке добавить `h-full flex flex-col` — иначе карточки разной высоты;
- hover (если кликабельна): `hover:border-[var(--hp-sub)]` — граница темнеет, ничего не поднимается;
- заголовок секции внутри: `font-bold text-[var(--hp-ink)] text-[15px]`.

## «Блок» — секция-реестр

Для наборов «подпись — значение» (детальная карточка, инфо-сайдбар) — **не** рассыпать
поля по мини-карточкам `bg-muted/30 p-3`, а собирать в один `.hp-block`.

```tsx
<div className="hp-block">
  <div className="hp-block-header">Контактные данные</div>
  <div className="hp-block-row">
    <span className="label">Телефон</span>
    <a href={`tel:${phone}`} className="value hover:text-[var(--hp-accent)] transition-colors">{phone}</a>
  </div>
</div>
```

Готовые классы в `globals.css`: `.hp-block`, `.hp-block-header`, `.hp-block-row`,
`.hp-block-grid` (две колонки), `.hp-block-item`.

## Заголовки

```tsx
<h1 className="text-[27px] font-bold text-[var(--hp-ink)] tracking-tight leading-tight">Название</h1>
<p className="text-[var(--hp-sub)] mt-1.5 text-sm font-medium">Описание или количество</p>
<h2 className="font-bold text-[var(--hp-ink)] text-[15px]">Секция</h2>
```

## Кнопки

```tsx
{/* CTA — плоский цвет, без градиента и без hover-подъёма */}
<Button variant="primary"><Plus className="w-4 h-4" />Добавить</Button>

{/* или руками */}
className="flex items-center gap-2 px-5 py-2.5 text-white rounded-[var(--hp-radius)] text-sm font-semibold transition-colors bg-[var(--hp-accent)] hover:bg-[var(--hp-accent-hover)]"

{/* вторичная */}
className="px-5 py-2.5 bg-[var(--hp-surface)] border border-[var(--hp-border)] rounded-[var(--hp-radius)] text-sm font-semibold text-[var(--hp-ink)] hover:border-[var(--hp-sub)] transition-colors"
```

## Поля форм

Готовые классы `.hp-input` и `.hp-label` делают ровно это — использовать их.

```tsx
<label className="hp-label">Название поля</label>
<input className="w-full h-10 px-4 rounded-[var(--hp-radius)] border border-[var(--hp-border)] bg-[var(--hp-surface)] text-[var(--hp-ink)] placeholder:text-[var(--hp-tertiary)] text-sm outline-none focus:border-[var(--hp-ink)] transition-colors" />
```

- высота `h-10`, padding `px-4` — жёстко везде (не `px-3`);
- фокус — `focus:border-[var(--hp-ink)]`, **не `ring`**;
- `select` — всегда `cursor-pointer`;
- `textarea` — `px-4 py-2.5 resize-none`, без `h-10`;
- `input[type=date]` — **обязательно `min-w-0`**, иначе overflow в iOS Safari.

## Бейджи

```tsx
<span className="hp-badge hp-badge-good">Активен</span>
<span className="hp-badge hp-badge-warn">VIP</span>
<span className="hp-badge hp-badge-info">Новый</span>
<span className="hp-badge hp-badge-danger">Просрочено</span>
<span className="hp-badge hp-badge-neutral">Клиент</span>
```

Бейдж — заливка цветом, **не** цветная полоса слева на карточке. `hp-danger` — только
по-настоящему тревожное (просрочено, удаление); «неактивный» — это `neutral`, не danger.

## Иконки и аватары

```tsx
{/* иконка-бокс: нейтральная заливка + hairline, НЕ цветной bg-green-50 */}
<div className="w-11 h-11 rounded-[var(--hp-radius)] flex items-center justify-center shrink-0 bg-[var(--hp-neutral-tint)] border border-[var(--hp-border)]">
  <Icon style={{ width: 20, height: 20, color: 'var(--hp-ink)' }} />
</div>

{/* аватар-инициал: квадрат, плоский акцент */}
<div className="w-10 h-10 rounded-[var(--hp-radius)] flex items-center justify-center shrink-0 text-white text-sm font-bold"
  style={{ background: 'var(--hp-accent)' }}>
  {name?.charAt(0)?.toUpperCase() ?? '?'}
</div>
```

Цветовое кодирование модулей (синий=лиды, фиолетовый=договоры) вычищено 01.09.2026 —
единственный акцент в системе один, цвет несёт только семантику статуса. Иконка-бокс
становится цветной, только если показатель тревожный («Просрочено»).

## Анимации

```tsx
className="transition-colors hover:border-[var(--hp-sub)]"
className="transition-colors duration-150 hover:bg-[var(--hp-neutral-tint)]"
```

Запрещено: `hover:-translate-y`, `hover:scale-`, `hover:shadow-lg`.
Framer Motion — только активный пункт Sidebar (`layoutId`) и Kanban drag-and-drop.

## Адаптивность — жёсткие правила

```tsx
// сетки — ВСЕГДА с breakpoint
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">   // не grid-cols-3

// группа кнопок/бейджей — всегда с переносом
<div className="flex items-center gap-2 flex-wrap shrink-0">
  <button className="whitespace-nowrap">…</button>
</div>

// шапка detail-страницы
<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">

// длинный текст рядом с бейджем
<span className="flex-1 min-w-0 truncate">…</span>
<span className="shrink-0 whitespace-nowrap">Бейдж</span>
```

**Stat-карточка — `min-w-0` на текстовом блоке и `break-words` на подписи**, иначе
«Администратор» вылезает за рамку:

```tsx
<div className="flex items-center gap-3 sm:gap-4">
  <Icon className="shrink-0" />
  <div className="min-w-0">
    <p className="text-2xl font-bold text-[var(--hp-ink)]">{count}</p>
    <p className="text-xs text-[var(--hp-sub)] font-medium mt-0.5 leading-tight break-words">{label}</p>
  </div>
</div>
```

## Вертикальный ритм

`space-y-6` на корневом div страницы · `space-y-4` между полями · `space-y-1.5`
между label и input · `gap-4` в grid.

---

## Общие компоненты — использовать вместо копирования разметки

| Компонент | Где | Зачем |
|---|---|---|
| `PageHeader` | `components/layout/` | крошки + H1 + бейджи + мета + кнопки. Все шапки только через него |
| `Breadcrumbs` | `components/layout/` | капс-крошки, обычно через `PageHeader` пропом `crumbs` |
| `StatStrip` | `components/layout/` | полоса показателей одной панелью вместо ряда мини-карточек |
| `RegistryToolbar` | `components/layout/` | поиск + фильтр-чипы + переключатель вида |
| `DealFormBody` | `features/deals/components/` | тело формы сделки для new и edit |

Форматтеры — `src/lib/utils.ts`: `formatAmount` (сумма без ₽, знак отдельным приглушённым
спаном), `formatDateCompact`, `formatRelative`, `formatDeadline` (`{label, overdue}`), `initials`.

Прочие готовые классы: `.hp-strip*`, `.hp-registry` + `.hp-registry-foot` + `.hp-page-btn`,
`.hp-stages` / `.hp-stage`, `.hp-chip`, `.hp-crumbs`, `.hp-meta`, `.hp-avatar`, `.hp-back-link`,
`.hp-card`, `.hp-empty`.

---

## Шаблоны страниц

Полные рабочие шаблоны (список / форма / детальная) — в `references/page-templates.md`
этого скила. Читать, когда создаёшь страницу с нуля.
