import Link from 'next/link'

export interface Crumb {
  label: string
  href?: string
}

/**
 * Хлебные крошки «Кабинета»: капс-подпись над заголовком страницы
 * (`СДЕЛКИ / ПЕРЕГОВОРЫ / СД-2041`). Последний элемент — текущая страница,
 * он не ссылка. Стиль — `.hp-crumbs` в globals.css.
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="hp-crumbs" aria-label="Хлебные крошки">
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={`${item.label}-${i}`} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden>/</span>}
            {item.href && !isLast ? (
              <Link href={item.href}>{item.label}</Link>
            ) : (
              <span className={isLast ? 'current' : undefined}>{item.label}</span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
