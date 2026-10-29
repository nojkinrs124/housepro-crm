---
name: housepro-release
description: "Пуш, PR, деплой и E2E HousePro: гейт, версия, ветка"
version: 2.0.0
author: HousePro
license: MIT
platforms: [linux, macos]
metadata:
  hermes:
    tags: [housepro, release, git, pr, deploy, e2e]
    related_skills: [housepro-migration, housepro-audit]
---

# Выкат HousePro CRM

## When to Use

- Пуш, PR, деплой, проверка прод-URL после выката.
- Надо понять, почему хук не пускает пуш или как поднять версию.
- Прогон E2E или смоук перед слиянием.


Единственная актуальная процедура. Раньше противоречили друг другу `CLAUDE.md`
(два места), `docs/WORKFLOW.md` и память Claude — они удалены, источник правды
здесь и в `AGENTS.md`.

## 1. Обязательный гейт

```bash
env -u HTTPS_PROXY -u HTTP_PROXY npm run check
```

Гоняет по порядку: `tsc` → event handlers → границы client/server → функции-пропы →
правила серверного слоя → поля форм → `any` → визуальный стандарт → словарь стадий →
кроны → `npm run build` → тесты. Шаги **не нумеруются** (номера разъезжались по
документам) — любой красный шаг = пуш запрещён. Полный список — в шапке
`scripts/pre-push-check.mjs`. Прогон ~4-6 минут, запускать в фоне.

При успехе пишется отпечаток кода в `scripts/checks/.check-stamp.json`. Хук
`guard-bash` пускает `git push`, только если отпечаток совпадает с текущим
содержимым `src/`, `scripts/` и корневых конфигов. Правил код после проверки —
прогнать заново.

**Почему одного `tsc`/`build` мало:** страницы с `export const dynamic =
'force-dynamic'` или с `cookies()` Next помечает как `ƒ Dynamic`, их тело во время
сборки не выполняется, и ошибка «функция из клиентского компонента вызвана на
сервере» проходит мимо обоих шагов и всплывает только в проде.

## 2. Версия

```bash
npm run version:patch   # исправление поведения
npm run version:minor   # новая возможность
npm run version:major   # ломающее изменение
```

Правки в `src/` или `supabase/migrations/` требуют бампа тем же коммитом — хук
сравнивает версию с `origin/main:package.json`. Только документация/тесты — не
требуют.

## 3. Ветка, коммит, PR

```bash
git checkout -b fix/<тема>          # или chore/…, feat/…
git add -A
git commit -m "fix(module): краткое описание"   # тело: что сделано, что проверено
env -u HTTPS_PROXY -u HTTP_PROXY git push -u origin HEAD
env -u HTTPS_PROXY -u HTTP_PROXY gh pr create --base main --fill
```

- **Токен в URL не использовать** — PAT в `git remote set-url` оседает в
  `git remote -v`, в истории шелла и в логах; хук такую команду блокирует.
- Ветка может содержать чужую работу (второй агент, сам владелец). Перед PR:
  `git log --oneline origin/main..HEAD` и `git diff --stat origin/main` — список
  файлов должен совпадать с задачей. Чужое не тащить в свой PR; если правки ещё не
  закоммичены, `git checkout origin/main -b <новая>` перенесёт их в новое дерево.
- Слияние — **отдельное разрешение**. По слову «сливай»: дождаться зелёных чеков
  (`gh pr view <n> --json mergeStateStatus,statusCheckRollup` — все `SUCCESS`,
  `CLEAN`), затем `gh pr merge <n> --merge --delete-branch`.
- Детали слияния, разбора красного CI, подключения домена и миграций через API —
  `references/deploy-and-release.md`.

## 4. Живой прогон (для значимых изменений)

Гейт не заменяет живую проверку. Поднять приложение и пройти затронутые экраны.

```bash
npx playwright test                                                  # по проду
E2E_BASE_URL=http://localhost:3000 npx playwright test --workers=1    # локально
```

- Доступы — в `.env.e2e` (под `.gitignore`), `playwright.config.ts` читает сам.
  Секреты в командную строку не тянуть.
- Локально **только `--workers=1`**: с двумя воркерами процесс убивают по памяти
  (exit 137). Полный прогон ~1-1.2 минуты.

## 5. После пуша

- Прод — **https://housepro24.ru** (`*.vercel.app` отдаёт 308 на канонический домен).
  Прежде чем обещать владельцу «появится на домене», проверить `getent ahosts housepro24.ru`
  и запросить страницу — домен мог отвалиться от хостинга.
- **Деплоя нет вовсе** (ни успешного, ни упавшего, CI зелёный) → первым делом
  `vercel.json`. Тариф Hobby разрешает крон не чаще раза в сутки; частое выражение
  Vercel отвергает при валидации и **молча отбрасывает весь деплой**. Всё, что чаще
  суток, — pg_cron в Supabase (`public.call_vercel_cron`, секрет в Vault).
  Это же проверяет шаг «vercel.json — кроны» в `npm run check`.
- pg_cron должен бить в `https://housepro24.ru/...`, а не в `*.vercel.app`: редирект
  теряет заголовок `Authorization` и крон получает 401.
- CI на GitHub гоняет тот же `npm run check`, но «зелёный CI» уже расходился с
  реальностью — после мержа чужих PR (dependabot) перепроверять локально.

## 6. Что обновить перед коммитом

- `README.md` — если появился новый модуль или заметная фича (таблица «Возможности»),
  тем же коммитом. Мелкие багфиксы не требуют; хук `verify-edits` напомнит.
- Глава `docs/handbook/` — если изменилось поведение раздела для сотрудника
  (после правки: `npm run seed:handbook`).
- Файл миграции в `supabase/migrations/` — вместе с кодом, не отдельным пушем.
- `docs/IMPROVEMENTS.md` — закрытый пункт помечается, новый добавляется.

## Не молчать

Длинные команды запускать в фоне и докладывать промежуточный статус: тишина на
несколько минут читается как зависание, даже когда работа идёт.
