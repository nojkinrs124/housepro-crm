# HousePro CRM

CRM система для агентств недвижимости. Next.js 16 + Supabase.

## Стек

- Next.js 16.2 · React 19 · TypeScript
- Tailwind CSS v4 · shadcn/ui
- Supabase (PostgreSQL + Auth + Storage)
- Vercel (деплой)

## Локальная разработка

```bash
git clone https://github.com/nojkinrs124/housepro-crm.git
cd housepro-crm
npm install --legacy-peer-deps
cp .env.local.example .env.local
# Заполни NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY из Supabase Dashboard
npm run dev
```

## Деплой на Vercel

1. Импортируй репозиторий на vercel.com
2. Добавь переменные окружения:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy

## Модули

| Модуль | Путь |
|--------|------|
| Дашборд | /dashboard |
| Лиды + Kanban | /leads |
| Контакты | /contacts |
| Сделки + Kanban | /deals |
| Объекты | /properties |
| Договоры + DOCX | /contracts |
| Платежи | /payments |
| Задачи + Kanban | /tasks |
| Сотрудники | /employees |
| Экспорт XML | /export |
| Настройки | /settings |
