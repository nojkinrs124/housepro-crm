# 🏠 HousePro CRM

**Production-ready Real Estate CRM System**

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/nojkinrs124/housepro-crm)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15+-black)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)](https://supabase.com/)

---

## 🚀 БЫСТРЫЙ СТАРТ (5 минут)

### 1. Клонируй репозиторий
```bash
git clone https://github.com/nojkinrs124/housepro-crm.git
cd housepro-crm
```

### 2. Установи зависимости
```bash
npm install
```

### 3. Настрой переменные окружения
```bash
cp .env.local.example .env.local
# Отредактируй .env.local с ключами Supabase
```

### 4. Загрузи тестовые данные
```bash
# Вариант 1: Автоматическая загрузка
npm run seed

# Вариант 2: Вручную в SQL Editor
# 1. Выполни supabase/schema.sql
# 2. Выполни tests/test-data.sql
```

### 5. Запусти приложение
```bash
npm run dev
```

Открой: **http://localhost:3000**

---

## 📖 Полная документация

| Документ | Содержание |
|----------|-----------|
| **[SETUP.md](./SETUP.md)** | 📚 Полный гайд установки |
| **[DEPLOYMENT.md](./DEPLOYMENT.md)** | 🚀 Развертывание |
| **[QA_AUDIT_REPORT.md](./QA_AUDIT_REPORT.md)** | 🔍 Аудит безопасности |

---

## ✨ Что включено

✅ **Полнофункциональное CRM:**
- Управление клиентами
- Управление недвижимостью
- Управление договорами (DOCX/PDF)
- Управление платежами
- Система лидов и сделок
- Управление задачами
- Аналитика и отчеты

✅ **Production-ready:**
- Type-safe TypeScript
- RLS на всех таблицах
- XSS protection
- 100+ тестовых записей
- Полная документация

---

## 🧪 Тестовые пользователи

```
admin@housepro.dev (админ)
manager1@housepro.dev (менеджер)
agent1@housepro.dev (агент)
```

---

## 🏗️ Технологический стек

- **Frontend:** Next.js 15, TypeScript, Tailwind, shadcn/ui
- **Backend:** Next.js API Routes
- **Database:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage (S3)
- **Auth:** Supabase Auth
- **Deployment:** Vercel (рекомендуется)

---

## 🔒 Безопасность

✅ Row-Level Security (RLS)  
✅ Authorization checks  
✅ Type-safe TypeScript  
✅ XSS protection  
✅ File upload validation  

---

## 📞 Поддержка

- 📧 Email: support@housepro.dev
- 🐛 Issues: [GitHub Issues](https://github.com/nojkinrs124/housepro-crm/issues)
- 📚 Docs: [SETUP.md](./SETUP.md)

---

**Made with ❤️ for Real Estate Professionals**

*Status: Production Ready ✅*  
*Version: 1.0.0*
