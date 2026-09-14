/**
 * Отзывы собственников — слот внутри TrustBlock («Экран 8»).
 *
 * Пока отзывов нет, рендерится пустота (`items.length === 0` → null): место
 * в вёрстке оставлено, наполним, когда соберём первые. Выдуманных отзывов
 * здесь быть не должно. Серверный компонент — без интерактивности,
 * без контейнера (живёт внутри секции TrustBlock).
 */

export interface Testimonial {
  author: string
  text: string
  /** Кто это — например, «собственник 2-комнатной, Советский район» */
  role?: string
}

interface Props {
  items: Testimonial[]
}

export function Testimonials({ items }: Props) {
  if (items.length === 0) return null

  return (
    <div className="mt-8">
      <h3 className="text-[18px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
        Отзывы собственников
      </h3>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(item => (
          <figure
            key={`${item.author}-${item.text}`}
            className="m-0 p-5 sm:p-6 border flex flex-col"
            style={{
              background: 'var(--hp-surface)',
              borderColor: 'var(--hp-border)',
              borderRadius: 'var(--hp-radius)',
            }}
          >
            <blockquote className="m-0 flex-1 text-[14px] leading-relaxed" style={{ color: 'var(--hp-ink)' }}>
              {item.text}
            </blockquote>
            <figcaption className="mt-4 text-[13px] leading-snug">
              <span className="font-bold" style={{ color: 'var(--hp-ink)' }}>
                {item.author}
              </span>
              {item.role && (
                <span className="block mt-0.5" style={{ color: 'var(--hp-tertiary)' }}>
                  {item.role}
                </span>
              )}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}
