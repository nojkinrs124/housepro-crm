# Карта документации HousePro CRM

Сверено 29.10.2026 (v2.46.2). Правила кода — `AGENTS.md` в корне, процедуры —
skills `.hermes/skills/housepro-*`, приоритеты — `IMPROVEMENTS.md`.

## Живые документы (обновляются вместе с кодом)

| Файл | Что внутри | Когда обновлять |
|---|---|---|
| [`../AGENTS.md`](../AGENTS.md) | Правила проекта: стек, границы client/server, Supabase, дизайн, версия, статус | при смене правил, не при каждой задаче |
| [`IMPROVEMENTS.md`](IMPROVEMENTS.md) | Единственный бэклог: открытые пункты, приоритеты, известные блокеры | закрыл/открыл пункт |
| [`WORKFLOW.md`](WORKFLOW.md) | Как мы работаем: контур, проверки, красные флаги, разрешения | при смене процесса |
| [`ARCHITECTURE-MAP.md`](ARCHITECTURE-MAP.md) | Карта кода: слои, модули по весу, потоки, данные, интеграции, тяжёлые файлы | при крупных структурных изменениях |
| [`ROADMAP.md`](ROADMAP.md) | Фазы SaaS-трансформации и аудитов, только статусы | при закрытии фазы |
| [`INTEGRATIONS.md`](INTEGRATIONS.md) | Почта, карты, площадки, подпись, платежи: как включается и где ломается | при добавлении интеграции |
| [`HIDDEN.md`](HIDDEN.md) | Что скрыто из интерфейса, но не удалено — с датой и причиной | при скрытии/возврате функции |
| [`JOURNAL.md`](JOURNAL.md) | Хроника сессий: что делали, что нашли, чем закончилось | по факту сессии |
| [`handbook/`](handbook/README.md) | Справочник для сотрудников по разделам CRM | правка экрана раздела → глава |
| [`../scripts/agent-hooks/README.md`](../scripts/agent-hooks/README.md) | Какие правила стерегут хуки Hermes, как подключить и проверить | правка хука или добавление запрета |

## Skills (процедуры, грузятся по требованию)

`.hermes/skills/` — один раз разрешить проектные skills: `hermes skills trust <корень репозитория>`
(в старых сборках — `hermes config set skills.trusted_project_dirs '["<путь>"]'`).
Машинные доступы (панель, вход в CRM, стенд) — отдельный skill `housepro-ops` в
`~/.hermes/skills/`: в публичный репозиторий они не попадают.

| Skill | Когда |
|---|---|
| `housepro-ui` | новая страница, форма, карточка, вёрстка |
| `housepro-migration` | любое изменение схемы БД, RLS, типов |
| `housepro-release` | пуш, PR, деплой, E2E |
| `housepro-new-module` | новая сущность CRM целиком |
| `housepro-audit` | аудит, QA, визуальная проверка, «почему цифры врут» |
| `housepro-telegram-bot` | поведение бота, уведомления владельцу |
| `housepro-seo` | индексация, Search Console/Яндекс, ключевые слова |
| `housepro-local-testing` | локальный стенд Supabase, RLS, живые тесты |

## Архив (история, не инструкции)

`archive/` — отработанные отчёты. Читать, чтобы понять «почему так», но не как
правила: `audits/` (аудиты 22 и 26.10, UX- и UI-аудиты, SEO-аудит),
`audit-remediation/` (PATCHLOG, TEST_REPORT, бэкапы удалённых строк),
`DESIGN_SYSTEM_AUDIT.md`, `SIMPLIFY-AUDIT.md`, `SIMPLIFY-REPORT.md`,
`ROADMAP-full.md`, `SPEC_KIT.md` + `spec-kit/` (Spec Kit использован один раз),
`qa/` (сценарии обхода), `uslugi/` (первые тексты услуг).

## Чего в репозитории больше нет

- `CLAUDE.md`, `src/app/api/CLAUDE.md`, `src/features/CLAUDE.md` → `AGENTS.md` в тех
  же каталогах (Hermes грузит `AGENTS.md`; `next dev` дописывает в него свой блок).
- `.claude/` (skills, agents, commands, hooks) → skills `.hermes/skills/housepro-*`
  и хуки `scripts/agent-hooks/`.
- `.specify/`, `specs/`, скиллы `speckit-*` → `archive/SPEC_KIT.md` и
  `archive/spec-kit/`.
- Baseline-файлы проверок: `.claude/*.json` → `scripts/checks/*-baseline.json`.
