#!/usr/bin/env bash
# Связать проектные skills Hermes с домашним каталогом skills.
#
# Зачем: skills проекта лежат в репозитории (.hermes/skills/housepro-*), но
# сборки Hermes до 0.20 не умеют читать skills из чекаута — они видят только
# ~/.hermes/skills. Скрипт кладёт туда симлинки, поэтому правка SKILL.md в
# репозитории действует сразу, без копирования и без расхождений.
#
# Когда запускать:
#   - первый раз после клонирования / переключения чекаута;
#   - если skills в Hermes «пропали» (удалили worktree, переехал репозиторий);
#   - после мержа ветки с новыми skills.
#
# Когда Hermes научится проектным skills (skills.trusted_project_dirs),
# скрипт можно не запускать; лишние симлинки удаляются этим же каталогом:
#   rm ~/.hermes/skills/housepro-*
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
src="$root/.hermes/skills"
dest="${HERMES_SKILLS_DIR:-$HOME/.hermes/skills}"

[ -d "$src" ] || { echo "нет $src — запускать из корня репозитория CRM" >&2; exit 1; }
mkdir -p "$dest"

linked=0
for skill in "$src"/*/; do
  name="$(basename "$skill")"
  target="$dest/$name"
  if [ -e "$target" ] && [ ! -L "$target" ]; then
    echo "пропуск $name — в $dest уже лежит настоящая папка (удали её вручную, если это копия)"
    continue
  fi
  ln -sfn "$skill" "$target"
  linked=$((linked + 1))
done

echo "связано skills: $linked → $dest"
echo "проверка: hermes skills list | grep housepro"
echo "если Hermes просит подтверждения на симлинк — это ожидаемо, skills из репозитория."
