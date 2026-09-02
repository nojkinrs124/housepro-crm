import pkg from '../../package.json'

/**
 * Версия CRM — единственный источник правды `package.json`.
 *
 * Раньше в футере настроек стояла строка «v1.0.0», зашитая руками, при
 * `"version": "0.1.0"` в package.json: понять по интерфейсу, что именно
 * задеплоено, было нельзя. Поднимается по semver при каждом изменении кода,
 * иначе хук guard-bash не пустит пуш (см. CLAUDE.md, «Версия»).
 */
export const APP_VERSION: string = pkg.version

/**
 * Короткий SHA сборки — его подставляет Vercel. Локально его нет, и это
 * нормально: он нужен, чтобы понять, какой именно коммит крутится в проде.
 */
export const BUILD_SHA: string | null =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null
