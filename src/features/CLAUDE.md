# Правила для features

Каждый модуль: `actions/` (`'use server'`) · `components/` (`'use client'`) · `services/`
(чистая логика, без React).

- **Граница client/server.** Из файла с `'use client'` серверный код может рендерить
  только PascalCase-компонент как JSX. Обычную функцию оттуда импортировать нельзя —
  вызов с сервера падает в рантайме, причём `tsc` и `next build` этого не видят.
  Чистые типы и функции выносить в отдельный файл без `'use client'` —
  образец: `contracts/utils/rent-apartment-data.ts`.
- **Дубль имени функции в `*.actions.ts`** = ошибка Turbopack «the name X is defined
  multiple times», чаще всего на `delete*Action`. Ловится хуком на правку
  (`scripts/checks/server-rules.mjs`), вручную грепать больше не нужно.
- **Каждый action:** авторизация → `requireOrgId()` → `await rateLimit*()` → Zod →
  запрос с `organization_id` → `writeAuditLog` → `revalidatePath`.
- **Формы** — через `ServerActionForm`, без `formAction()`-антипаттерна.
- **Файл вырос за 300 строк** — логику в `services/`, не оставлять «раз уж всё равно тут».
- **Денежные и юридические потоки** (payments, contracts, billing) — обязательно тест
  на поток, даже если остальное без тестов.
- Разметка компонентов — по skill `housepro-ui`.
