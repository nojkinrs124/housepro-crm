# HousePro CRM

CRM система для агентства недвижимости. Клиенты, объекты, договоры — всё в одном месте.

## Стек
- **Frontend**: Next.js 16 + TypeScript + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Deploy**: Vercel

## Быстрый старт

```bash
npm install
cp .env.example .env.local  # заполни своими ключами
npm run dev
```

Открой: http://localhost:3000

## База данных

Выполни `supabase/schema.sql` в Supabase SQL Editor — создаст все таблицы, RLS, индексы.

## Структура

```
src/
  app/(auth)/login          # Страница входа
  app/(dashboard)/          # CRM страницы
  components/layout/        # Sidebar, Header
  features/                 # Модули (clients, contracts, properties...)
  lib/supabase/             # Клиент Supabase
  types/database.ts         # TypeScript типы
  middleware.ts             # Auth защита
supabase/schema.sql         # Полная схема БД
```

## Роли: admin | manager | agent | accountant

## Deploy: GitHub → Vercel (автодеплой)
