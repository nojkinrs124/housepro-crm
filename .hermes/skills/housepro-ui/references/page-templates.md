# Шаблоны страниц — «Кабинет»

Скопировать и адаптировать. Эталоны в коде: `src/app/(dashboard)/contacts/*`.
Токены, бейджи, поля форм и правила адаптивности — в `SKILL.md`.

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

