# Хуки Hermes для HousePro

Правила проекта, которые нельзя доверять памяти. Скрипты живут здесь и
версионируются вместе с кодом; подключаются один раз в `~/.hermes/config.yaml`.

## Что проверяется

| Скрипт | Событие | Что делает |
|---|---|---|
| `guard-bash.mjs` | `pre_tool_call` (terminal) | не даёт `git push` без зелёного `npm run check` и без бампа версии; не даёт `npm install` без `--legacy-peer-deps`; блокирует запрещённые пакеты и попытки вытащить секреты в командную строку |
| `guard-migration.mjs` | `pre_tool_call` (`APPLY_A_MIGRATION`) | требует парную миграцию `down`, запрещает `DROP/TRUNCATE` без явного backup-плана, проверяет идемпотентность |
| `guard-sql.mjs` | `pre_tool_call` (`RUN_READ_ONLY_QUERY`) | DDL и запись в read-only инструменте — блок |
| `verify-edits.mjs` | `pre_verify` | один раз в конце хода проверяет **изменённые** файлы: палитра Tailwind → отказ (только `var(--hp-*)`), новые `: any`, пересечение client/server границы, README/handbook при правке экрана |

Все скрипты — **fail-open вне репозитория CRM**: хук глобальный, а проект один,
поэтому вне чекаута они молча выходят с кодом 0 и ничего не блокируют.

## Формат входа и выхода

Hermes присылает на stdin JSON:

```json
{
  "hook_event_name": "pre_tool_call",
  "tool_name": "terminal",
  "tool_input": { "command": "git push origin main" },
  "session_id": "...",
  "cwd": "/home/.../housepro-crm",
  "extra": {}
}
```

`tool_input` — это ровно аргументы инструмента: `command` у `terminal`,
`path` у `write_file`/`patch`, `query` у Supabase-миграции. Ответ — JSON в
stdout, `{"decision":"block","reason":"..."}` для блокировки;
пустой stdout = разрешено. Ненулевой код выхода Hermes только логирует,
поэтому блокировка выражается **только** через stdout.

## Подключение

В `~/.hermes/config.yaml`:

```yaml
hooks:
  pre_tool_call:
  - matcher: terminal
    command: /home/ruslan/.hermes/agent-hooks/housepro-hook.sh guard-bash
    timeout: 25
  - matcher: connectors__supabase__APPLY_A_MIGRATION
    command: /home/ruslan/.hermes/agent-hooks/housepro-hook.sh guard-migration
    timeout: 25
  - matcher: connectors__supabase__RUN_READ_ONLY_QUERY
    command: /home/ruslan/.hermes/agent-hooks/housepro-hook.sh guard-sql
    timeout: 25
  pre_verify:
  - command: /home/ruslan/.hermes/agent-hooks/housepro-hook.sh verify-edits
    timeout: 90
```

`housepro-hook.sh` — тонкий диспетчер вне репозитория: он находит чекаут
(основной или worktree), в котором есть эти скрипты, и передаёт payload дальше.
Нужен потому, что путь к репозиторию у владельца бывает разным, а хук
прописывается глобально.

Согласие на хуки даётся один раз: `hermes --accept-hooks chat -q ok`
(или подтверждение в TTY). Проверка состояния:

```bash
hermes hooks list      # настройки + статус allowlist
hermes hooks doctor    # существование, права, allowlist, дрейф файла, время
```

## Как проверить правку хука

```bash
node scripts/agent-hooks/guard-bash.mjs < scripts/agent-hooks/fixtures/pre_tool_call-terminal-push.json
# → {"decision":"block", ...}

hermes hooks test pre_tool_call --for-tool terminal \
  --payload-file /tmp/pf.json
# payload-файл в формате Hermes: {"tool_name":"terminal","args":{"command":"git push"}}
```

Важно: в `hermes hooks test --payload-file` ключ называется `args`, а не
`tool_input` (файл подмешивается в синтетический payload до сериализации).
Фикстуры в `fixtures/` написаны в форме уже сериализованного payload
(`tool_input`) — они для прямого запуска скрипта.

## Чего здесь нет

- Стэмп «последняя зелёная проверка» и baseline-файлы проверок — рядом,
  в `scripts/checks/` (`.check-stamp.json`, `design-baseline.json`,
  `any-baseline.json`).
- Ветвление, PR, бамп версии — это `housepro-release`, а не хук. Хук только не
  пускает пуш, если проверки не прошли.
