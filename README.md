<div align="center">

# 🏠 HousePro CRM

**SaaS-платформа для управления агентством недвижимости**

Лиды → Сделки → Договоры → Платежи → Аналитика — в одном месте.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

</div>

---

## Что это

**HousePro CRM** — многопользовательская (multi-tenant) система для риелторских агентств: ведение лидов и сделок, объекты недвижимости, договоры с автогенерацией DOCX, платежи, аналитика, показы объектов, публичные подборки для клиентов и Telegram-бот для быстрых операций с телефона.

Проект построен как полноценный SaaS: организации изолированы через Row Level Security на уровне базы данных, есть биллинг на Stripe, онбординг новых агентств и публичный REST API для интеграций.

Сделка сама двигается по воронке вслед за реальными действиями: договор создан из карточки сделки → сделка на стадии «Договор»; DOCX сформирован → «Оплата»; платёж отмечен оплаченным → «Завершено». Интерфейс поддерживает светлую и тёмную тему.

## ✨ Возможности

| Модуль | Что умеет |
|---|---|
| 🧲 **Лиды** | Kanban-доска, воронка, быстрая конвертация в сделку |
| 🤝 **Сделки** | Kanban, комментарии, версионирование договоров |
| 👤 **Контакты** | Единая карточка клиента/собственника, физлица и юрлица с реквизитами |
| 🏢 **Объекты** | Каталог недвижимости, фото, показы |
| 📁 **Подборки** | Публичная ссылка с объектами под лида — открывается без входа в CRM |
| 📄 **Договоры** | Автогенерация DOCX по шаблонам, история версий с восстановлением |
| 📚 **Бухгалтерия** | Доходы/расходы, повторяющиеся операции, P&L по месяцам, платежи по договорам |
| ✅ **Задачи** | Kanban-доска задач с дедлайнами |
| 👥 **Сотрудники** | Роли (admin/manager/agent/accountant), KPI-статистика |
| 📊 **Аналитика** | Воронка, конверсия, платежи — с произвольным периодом (Recharts) |
| 🏘 **Показы** | Планирование показов объектов, фиксация результата |
| 🔍 **Поиск** | Глобальный поиск по всей системе (Ctrl+K) |
| 📤 **Экспорт** | XML для Avito/CIAN, CSV для 1С |
| 🤖 **Telegram-бот** | Создание сделок и лидов, учёт операций, голосовые заметки — прямо из Telegram |
| 💰 **Биллинг** | Тарифы Free/Pro/Enterprise на Stripe, feature gates |
| 🔌 **API** | Публичный REST API `/api/v1` с ключами и HMAC-подписанными вебхуками |
| 🛡 **Аудит** | Журнал всех изменений по организации |
| 📞 **Коммуникации** | Единая лента общения: звонки из АТС, WhatsApp, письма, заметки |
| ✉️ **Почта** | Договоры, напоминания об оплате, подборки и приглашения на показ — письмом клиенту |
| 🗓 **Календарь** | Календарь показов и подписка на него в Google/Яндекс/Apple по ссылке |
| 🧾 **Сверка** | Ссылки на онлайн-оплату (ЮKassa) и импорт банковской выписки 1С |
| ✍️ **Подпись** | Простая электронная подпись договора по ссылке с кодом из письма |
| 📥 **Импорт** | Перенос базы контактов, объектов и лидов из Excel/CSV |
| 🧹 **Дубли** | Поиск и слияние дублей контактов по телефону и почте |

## 🧱 Технологический стек

- **Frontend:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui
- **Backend:** Supabase (PostgreSQL + Auth + Storage), Row Level Security на уровне организации
- **Оплата:** Stripe Billing (подписка на CRM) · ЮKassa (платежи клиентов агентства)
- **Интеграции:** DaData (адреса и реквизиты), Яндекс.Карты, телефония (Манго/UIS/Zadarma),
  WhatsApp (Wazzup/Green API), Авито-мессенджер, фиды Авито/ЦИАН/Яндекс/Домклик
- **Документы:** docxtemplater + pizzip (генерация DOCX по шаблонам)
- **Аналитика/графики:** Recharts
- **UX:** Framer Motion, sonner (toasts), @dnd-kit (drag-and-drop)
- **Качество:** Vitest, Sentry, GitHub Actions CI
- **Деплой:** Vercel

## 🚀 Быстрый старт

```bash
git clone https://github.com/nojkinrs124/housepro-crm.git
cd housepro-crm

# зависимости (обязательно с этим флагом)
npm install --legacy-peer-deps

# переменные окружения
cp .env.local.example .env.local
# заполни NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY
# из Supabase Dashboard → Project Settings → API

npm run dev
```

Приложение будет доступно на [http://localhost:3000](http://localhost:3000).

### Проверка перед коммитом

```bash
npm run check
```

Прогоняет по цепочке: проверку типов → сканер event-хендлеров в Server Components → анализ границы client/server → сборку → тесты. Тот же скрипт выполняется в CI при каждом push/PR.

## ☁️ Деплой

1. Импортируй репозиторий на [vercel.com](https://vercel.com)
2. Добавь переменные окружения в настройках проекта:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (только на сервере)
   - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (rate limiting)
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (биллинг)
   - `RESEND_API_KEY` или `UNISENDER_API_KEY` + `EMAIL_FROM` (почта клиентам)
   - `DADATA_API_KEY` (подсказки адресов и реквизитов, координаты объектов)
   - `NEXT_PUBLIC_YANDEX_MAPS_KEY` (карты в подборках и на карточке объекта)
   - `CRON_SECRET` (задачи по расписанию из `vercel.json`)
3. Deploy

Подключение телефонии, WhatsApp и приёма платежей делается не через переменные
окружения, а в интерфейсе — у каждого агентства свои учётные данные.
Полное руководство по всем интеграциям — [`docs/INTEGRATIONS.md`](./docs/INTEGRATIONS.md).

## 📁 Структура проекта

```
src/
  app/
    (auth)/          # страницы авторизации
    (dashboard)/      # основные разделы CRM
    api/v1/           # публичный REST API
  components/         # переиспользуемые UI-компоненты
  features/           # бизнес-логика по модулям (actions, components, services)
  lib/                # supabase-клиенты, права доступа, rate limiting, аудит
  types/               # общие TypeScript-типы
supabase/
  migrations/          # история миграций БД
  functions/            # Edge Functions (в т.ч. Telegram-бот)
```

Полное руководство по паттернам и правилам разработки — в [`CLAUDE.md`](./CLAUDE.md),
по подключению внешних сервисов — в [`docs/INTEGRATIONS.md`](./docs/INTEGRATIONS.md).

## 🧪 Тесты

```bash
npm test              # разовый прогон
npm run test:watch    # watch-режим
npm run test:coverage # с покрытием
```

## 📜 Лицензия

Проект распространяется под лицензией **MIT** — см. [LICENSE](./LICENSE).
Это значит, что код можно свободно использовать, копировать, модифицировать и распространять, в том числе в коммерческих целях, при условии сохранения уведомления об авторстве.

---

<div align="center">
Сделано для риелторских агентств 🏡
</div>
