import { BrandMark } from './BrandMark'

/**
 * Логотип «ХаусПро» для шапок: знак + название + имя.
 * Название и имя — живым текстом (шрифты уже загружены на странице), чтобы
 * читались скринридером и поиском. Для файлов и печати — SVG из brand/logo/.
 *
 * tone="dark" — на лесном фоне (подвал сайта).
 */
interface Props {
  markSize?: number
  caption?: string | null
  tone?: 'light' | 'dark'
}

export function BrandLogo({ markSize = 36, caption = 'Руслан Ножкин', tone = 'light' }: Props) {
  const ink = tone === 'dark' ? 'var(--hp-on-forest)' : 'var(--hp-ink)'
  const sub = tone === 'dark' ? 'var(--hp-on-forest-sub)' : 'var(--hp-sub)'
  return (
    <span className="flex items-center gap-3 min-w-0">
      <BrandMark size={markSize} />
      <span className="min-w-0 leading-none">
        <span
          className="block text-[20px] font-bold"
          style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: ink, letterSpacing: '-0.015em' }}
        >
          ХаусПро
        </span>
        {caption && (
          <span
            className="block mt-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] truncate"
            style={{ color: sub }}
          >
            {caption}
          </span>
        )}
      </span>
    </span>
  )
}
