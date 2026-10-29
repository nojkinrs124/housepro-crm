# .hermes — агентская обвязка проекта

| Что | Зачем |
|---|---|
| `skills/housepro-*` | Процедуры проекта: ui, migration, new-module, release, audit, telegram-bot, seo, local-testing. Грузятся по требованию, не в каждом контексте |

Правила (всегда в контексте) — `../AGENTS.md`, а не здесь. Хуки — `../scripts/agent-hooks/`.

## Как подключить skills

Сборки Hermes до 0.20 читают skills только из `~/.hermes/skills`, поэтому в
репозитории лежат исходники, а в домашний каталог кладутся симлинки:

```bash
./scripts/link-agent-skills.sh          # из корня чекаута
hermes skills list | grep housepro      # проверить, что видны
```

Симлинки указывают на тот чекаут, из которого запущен скрипт. Если skills
«пропали» (переехал репозиторий, удалили worktree) — запустить скрипт заново из
нужного чекаута.

В новых версиях Hermes достаточно один раз разрешить проектные skills:
`hermes config set skills.trusted_project_dirs '["<путь к репо>"]'`, и симлинки
не нужны.

## Добавить новый skill

1. Папка `.hermes/skills/housepro-<тема>/SKILL.md`.
2. Frontmatter: `name`, `description` (до 60 символов, с чего начинать — «Пуш, PR,
   деплой…»), `metadata.hermes.tags`/`related_skills`.
3. В теле обязателен `## When to Use` — 2–4 пункта «когда открывать».
4. Ссылки на детали — `references/*.md` рядом, а не в теле (тело читается всегда).
5. Дописать строку в таблицу «Указатель» в `AGENTS.md` и в `docs/INDEX.md`.
6. `./scripts/link-agent-skills.sh` (если skill новый).

Машинные пути, пароли, LAN-адреса и имена записей панели в репозиторий не
попадают: репозиторий публичный. Для этого есть `housepro-ops` в `~/.hermes/skills`.
