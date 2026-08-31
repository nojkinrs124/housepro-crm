'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Building2, ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * Галерея фото объекта: крупный кадр + лента миниатюр.
 * Заглушка при отсутствии фото — плоская плашка нейтрального тона с рамкой,
 * а не градиентный прямоугольник (см. визуальный стандарт «Кабинет»).
 */
export function PropertyGallery({ photos, title }: { photos: string[]; title: string }) {
  const [index, setIndex] = useState(0)

  if (photos.length === 0) {
    return (
      <div
        className="w-full aspect-[16/10] flex flex-col items-center justify-center gap-3 border"
        style={{
          background: 'var(--hp-neutral-tint)',
          borderColor: 'var(--hp-border)',
          borderRadius: 'var(--hp-radius)',
        }}
      >
        <Building2 style={{ width: 32, height: 32, color: 'var(--hp-tertiary)' }} />
        <p className="text-[13.5px] font-medium px-6 text-center" style={{ color: 'var(--hp-sub)' }}>
          Фотографии этого объекта пришлём по запросу — оставьте заявку или позвоните
        </p>
      </div>
    )
  }

  const safeIndex = Math.min(index, photos.length - 1)
  const move = (delta: number) =>
    setIndex(prev => (prev + delta + photos.length) % photos.length)

  return (
    <div className="space-y-2.5">
      <div
        className="relative w-full aspect-[16/10] overflow-hidden border"
        style={{
          background: 'var(--hp-neutral-tint)',
          borderColor: 'var(--hp-border)',
          borderRadius: 'var(--hp-radius)',
        }}
      >
        <Image
          key={photos[safeIndex]}
          src={photos[safeIndex]!}
          alt={`${title} — фото ${safeIndex + 1}`}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 720px"
          className="object-cover"
        />

        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => move(-1)}
              aria-label="Предыдущее фото"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center border transition-colors"
              style={{
                background: 'var(--hp-surface)',
                borderColor: 'var(--hp-border)',
                color: 'var(--hp-ink)',
                borderRadius: 'var(--hp-radius)',
              }}
            >
              <ChevronLeft style={{ width: 18, height: 18 }} />
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              aria-label="Следующее фото"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center border transition-colors"
              style={{
                background: 'var(--hp-surface)',
                borderColor: 'var(--hp-border)',
                color: 'var(--hp-ink)',
                borderRadius: 'var(--hp-radius)',
              }}
            >
              <ChevronRight style={{ width: 18, height: 18 }} />
            </button>
            <span
              className="absolute right-3 bottom-3 px-2.5 py-1 text-[12px] font-semibold border"
              style={{
                background: 'var(--hp-surface)',
                borderColor: 'var(--hp-border)',
                color: 'var(--hp-sub)',
                borderRadius: 'var(--hp-radius)',
              }}
            >
              {safeIndex + 1} / {photos.length}
            </span>
          </>
        )}
      </div>

      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Показать фото ${i + 1}`}
              className="relative w-24 h-[68px] shrink-0 overflow-hidden border transition-colors"
              style={{
                borderColor: i === safeIndex ? 'var(--hp-ink)' : 'var(--hp-border)',
                background: 'var(--hp-neutral-tint)',
                borderRadius: 'var(--hp-radius)',
              }}
            >
              <Image src={src} alt="" fill sizes="96px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
