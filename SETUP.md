# 🚀 HousePro CRM - Complete Setup Guide

**Статус:** Production Ready ✅  
**Дата:** 2026-05-30  
**Версия:** 1.0.0

---

## 📋 Что включено

Этот гайд содержит полные инструкции по:
1. ✅ Настройке Supabase (облачная БД)
2. ✅ Альтернатива: Локальная Supabase (Docker)
3. ✅ Загрузке тестовых данных
4. ✅ Развертыванию приложения
5. ✅ Тестированию всех функций

---

## 🎯 ВАРИАНТ 1: Облачная Supabase (Быстро - 10 минут)

### Шаг 1: Создайте Supabase проект

1. Перейди на https://app.supabase.com
2. Кликни "New Project"
3. Выбери организацию
4. Заполни:
   - **Name:** `housepro-crm`
   - **Database Password:** (сохрани, понадобится!)
   - **Region:** `eu-central-1` (или ближайший)
5. Кликни "Create new project"
6. Подожди 5-10 минут пока инициализируется

### Шаг 2: Получи ключи доступа

1. Перейди в **Settings → API**
2. Скопируй:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` → `SUPABASE_SERVICE_ROLE_KEY`

### Шаг 3: Настрой переменные окружения

```bash
# В корне проекта
cp .env.local.example .env.local

# Отредактируй .env.local и вставь ключи:
# NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
# SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Шаг 4: Загрузи схему БД

```bash
# В Supabase Dashboard → SQL Editor
# 1. Кликни "New query"
# 2. Скопируй весь текст из: supabase/schema.sql
# 3. Вставь в SQL Editor
# 4. Кликни "Run"
# 5. Дождись завершения (1-2 минуты)
```

### Шаг 5: Загрузи тестовые данные

```bash
# В Supabase Dashboard → SQL Editor
# 1. Кликни "New query"
# 2. Скопируй весь текст из: tests/test-data.sql
# 3. Вставь в SQL Editor
# 4. Кликни "Run"
# 5. Дождись завершения (30 секунд)
```

### Шаг 6: Создай Storage buckets

В Supabase Dashboard → Storage → Create bucket:

```
1. contracts (Private)
2. documents (Private)
3. document-templates (Private)
4. property-photos (Public)
5. avatars (Public)
6. passports (Private)
```

Для каждого bucket:
- Кликни "Create new bucket"
- Введи название из списка выше
- Выбери Public/Private
- Кликни "Create"

### Шаг 7: Установи и запусти приложение

```bash
# Установи зависимости
npm install

# Собери проект
npm run build

# Запусти локальный сервер
npm run dev
```

Откройся в браузере: **http://localhost:3000**

---

## 🐳 ВАРИАНТ 2: Локальная Supabase (Docker - 15 минут)

Лучше для разработки без необходимости облачного сервиса.

### Требования

- Docker установлен
- Docker Compose установлен
- 4GB свободной памяти

### Шаг 1: Запусти Supabase локально

```bash
# В корне проекта
docker-compose up -d

# Дождись инициализации (2-3 минуты)
docker-compose logs -f

# Когда увидишь "ready", жми Ctrl+C
```

### Шаг 2: Откройся в браузере

```
Supabase Studio: http://localhost:3000
PostgreSQL: localhost:5432
API: http://localhost:8000
Mailpit (email): http://localhost:8025
```

### Шаг 3: Загрузи схему БД

1. Перейди http://localhost:3000
2. Используй SQL Editor
3. Скопируй-вставь `supabase/schema.sql`
4. Запусти запрос

### Шаг 4: Загрузи тестовые данные

1. В SQL Editor создай новый запрос
2. Скопируй-вставь `tests/test-data.sql`
3. Запусти запрос

### Шаг 5: Настрой переменные окружения

```bash
# Скопируй template
cp .env.local.example .env.local

# Отредактируй .env.local для локальной разработки:
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJpc3MiOiAic3VwYWJhc2UiLAogICJyZWYiOiAiMHkzY3g2cWRxdDRzc3k0MiIsCiAgInJvbGUiOiAiYW5vbiIsCiAgImlhdCI6IDE3MTYxNDUwMDAsCiAgImV4cCI6IDE4NzM5MDkwMDAKfQ.V-4lTNp5J8PdJRb_P9wPUvqP9Q0Y3eqnRf5gE3U9xjc
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJpc3MiOiAic3VwYWJhc2UiLAogICJyZWYiOiAiMHkzY3g2cWRxdDRzc3k0MiIsCiAgInJvbGUiOiAic2VydmljZV9yb2xlIiwKICAiaWF0IjogMTcxNjE0NTAwMCwKICAiZXhwIjogMTg3MzkwOTAwMAp9.1F0PIQJ0Hei3OPPfYGjGfXCqPcnFj8EwVxnqxd1OhbY
```

### Шаг 6: Запусти приложение

```bash
npm install
npm run dev
```

Открой: **http://localhost:3000**

---

## ✅ Быстрая проверка после установки

### 1. Проверка БД

```bash
# Открой Supabase SQL Editor
# Выполни запрос:
SELECT COUNT(*) as users_count FROM public.users;
SELECT COUNT(*) as clients_count FROM public.clients;
SELECT COUNT(*) as properties_count FROM public.properties;

# Должно вывести по несколько записей в каждой таблице
```

### 2. Проверка Storage

```bash
# В Supabase Dashboard → Storage
# Проверь что есть все 6 buckets:
✓ contracts (Private)
✓ documents (Private)
✓ document-templates (Private)
✓ property-photos (Public)
✓ avatars (Public)
✓ passports (Private)
```

### 3. Проверка приложения

1. Откройся **http://localhost:3000**
2. Проверь что загружается без ошибок
3. Попытайся залогиниться (любые credentials работают в тестовом режиме)
4. Проверь что видишь данные на страницах

---

## 🧪 Тестовые данные

После загрузки `tests/test-data.sql` можешь использовать эти тестовые пользователи:

```sql
-- Администратор
Email: admin@housepro.dev
Role: admin

-- Менеджеры
Email: manager1@housepro.dev
Email: manager2@housepro.dev
Role: manager

-- Агенты
Email: agent1@housepro.dev
Email: agent2@housepro.dev
Email: agent3@housepro.dev
Role: agent

-- Бухгалтер
Email: accountant@housepro.dev
Role: accountant
```

Плюс включены:
- 5 собственников с профилями
- 8 клиентов на разных стадиях
- 5 потенциальных клиентов (лидов)
- 9 объектов недвижимости
- 6 договоров в разных статусах
- 4 завершенные сделки
- 8 платежей (оплачено, ожидание, просрочено)
- 5 задач с приоритетами
- История версий договоров

---

## 🐛 Решение проблем

### Проблема: "Table ... does not exist"

**Решение:**
1. Откройся Supabase SQL Editor
2. Выполни `supabase/schema.sql` еще раз
3. Убедись что нет ошибок при выполнении

### Проблема: "Bucket ... does not exist"

**Решение:**
1. Перейди Supabase → Storage
2. Вручную создай missing buckets
3. Убедись правильные permission (Private/Public)

### Проблема: "Failed to fetch" ошибки

**Решение:**
1. Проверь NEXT_PUBLIC_SUPABASE_URL в .env.local
2. Убедись что Supabase инстанс запущен и доступен
3. Очисти браузер cache: Ctrl+Shift+Delete

### Проблема: "Auth failed"

**Решение:**
1. Проверь NEXT_PUBLIC_SUPABASE_ANON_KEY в .env.local
2. Убедись что это правильный ключ (anon, не service_role)
3. Перезагрузи браузер

### Проблема: Docker контейнеры не запускаются

**Решение:**
```bash
# Очисти Docker
docker-compose down -v
docker system prune -a

# Перезапусти
docker-compose up -d

# Проверь логи
docker-compose logs
```

---

## 📚 Важные файлы

| Файл | Назначение |
|------|-----------|
| `.env.local.example` | Template переменных окружения |
| `supabase/schema.sql` | Полная схема базы данных |
| `tests/test-data.sql` | Тестовые данные (100+ записей) |
| `docker-compose.yml` | Локальная Supabase разработка |
| `setup.sh` | Скрипт автоматической настройки |
| `DEPLOYMENT.md` | Полный гайд развертывания |
| `QA_AUDIT_REPORT.md` | Подробный отчет всех исправлений |
| `FIXES_SUMMARY.md` | Быстрая справка по исправлениям |

---

## 🚀 Как запустить в продакшене

### На Vercel (рекомендуется)

```bash
# 1. Запусти из GitHub
# 2. Vercel автоматически обнаружит Next.js проект
# 3. Добавь переменные окружения в Vercel → Settings → Environment
#    - NEXT_PUBLIC_SUPABASE_URL
#    - NEXT_PUBLIC_SUPABASE_ANON_KEY
#    - NEXTAUTH_SECRET
# 4. Deploy
```

### На собственном сервере

```bash
# 1. Собери приложение
npm run build

# 2. Запусти продакшен
npm start

# 3. Используй PM2 для управления процессом
npm install -g pm2
pm2 start npm --name "housepro" -- start
pm2 save
```

---

## 📊 Архитектура

```
┌─────────────────────────────────────────────┐
│          Next.js Application                 │
│      (Front-end + Backend API Routes)       │
└──────────────────┬──────────────────────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
    ┌────▼────┐      ┌──────▼──────┐
    │ Supabase│      │   Storage   │
    │  Auth   │      │   (Buckets) │
    └────┬────┘      └──────┬──────┘
         │                   │
    ┌────▼──────────────────▼────┐
    │   PostgreSQL Database      │
    │  (Schema + Test Data)      │
    └────────────────────────────┘
```

---

## ✨ Следующие шаги

После успешной установки:

1. **Familiarize** - Изучи приложение, протестируй основные функции
2. **Customize** - Адаптируй под свои нужды (брендинг, иконки, тексты)
3. **Extend** - Добавь новые функции по потребности
4. **Deploy** - Развертай на Vercel или свой сервер
5. **Monitor** - Настрой мониторинг и логирование

---

## 📞 Поддержка

При проблемах:

1. Проверь это руководство (раздел "Решение проблем")
2. Посмотри логи: `docker-compose logs` или консоль браузера
3. Проверь Supabase Dashboard → Logs
4. Убедись что все файлы загружены правильно

---

## 🎉 Готово!

Теперь у тебя полностью функциональное HousePro CRM приложение с:
- ✅ Полной архитектурой
- ✅ Тестовыми данными
- ✅ Всеми исправлениями безопасности
- ✅ Production-ready кодом
- ✅ Документацией

**Happy coding! 🚀**

---

*Документация актуальна на 2026-05-30*  
*Version: 1.0.0*  
*Status: Production Ready*
