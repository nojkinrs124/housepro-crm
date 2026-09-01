# Правила для API routes

- **Supabase-клиент** — `getSupabaseAdmin()` лениво **внутри** хендлера, с `no-store`
  fetch-конфигом. Не копировать инстанциацию в очередной файл: если паттерн повторяется,
  выносить в общий `withOrgAuth()` / `withApiKeyAuth()`.
- **GET с данными по организации** — обязательно `export const dynamic = 'force-dynamic'`,
  иначе Next закэширует ответ на билде и все арендаторы получат чужие данные.
- **Публичный API `/api/v1`** — авторизация только через `authenticateApiKey()`
  (`src/lib/api-auth.ts`), org берётся из ключа, не из сессии.
- **Вебхуки внутрь** (`/api/stripe`, `/api/telegram`, `/api/signing`) — проверять подпись
  до любой работы с телом запроса; тело читать как `text()`, а не `json()`, иначе
  подпись не сойдётся.
- **Кроны** (`/api/cron/*`) — сверять `CRON_SECRET`. Расписание в `vercel.json` только
  суточное и реже; чаще — GitHub Actions (см. `.github/workflows/channel-heartbeat.yml`).
- Секреты — из `env.ts`, не из `process.env` напрямую.
