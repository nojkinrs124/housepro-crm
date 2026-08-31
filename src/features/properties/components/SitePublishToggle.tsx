'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Globe, Loader2 } from 'lucide-react'
import { togglePropertySitePublishAction } from '@/features/properties/actions/site-publish.actions'

/**
 * Панель «Публикация на сайте» для карточки объекта.
 * Визуально — стандарт «Кабинет»: плоский тон, hairline-граница, radius 0.
 */
export function SitePublishToggle({
  propertyId,
  isPublished,
}: {
  propertyId: string
  isPublished: boolean
}) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleToggle() {
    setLoading(true)
    const res = await togglePropertySitePublishAction(propertyId, !isPublished)
    setLoading(false)

    if (res && 'error' in res && res.error) {
      toast.error(res.error)
      return
    }
    toast.success(isPublished ? 'Объект снят с публикации на сайте' : 'Объект опубликован на сайте')
    router.refresh()
  }

  return (
    <div
      className="p-5 border space-y-3"
      style={{
        background: 'var(--hp-surface)',
        borderColor: 'var(--hp-border)',
        borderRadius: 'var(--hp-radius)',
      }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="w-9 h-9 flex items-center justify-center shrink-0 border"
          style={{
            background: 'var(--hp-neutral-tint)',
            borderColor: 'var(--hp-border)',
            borderRadius: 'var(--hp-radius)',
          }}
        >
          <Globe style={{ width: 16, height: 16, color: 'var(--hp-ink)' }} />
        </div>
        <div className="min-w-0">
          <h2 className="font-bold text-[15px]" style={{ color: 'var(--hp-ink)' }}>
            Сайт «ХаусПро»
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--hp-sub)' }}>
            Публичный каталог на housepro
          </p>
        </div>
      </div>

      <span className={`hp-badge ${isPublished ? 'hp-badge-good' : 'hp-badge-neutral'}`}>
        {isPublished ? 'Опубликован' : 'Не опубликован'}
      </span>

      {isPublished && (
        <a
          href={`/catalog/${propertyId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-xs font-medium underline underline-offset-2"
          style={{ color: 'var(--hp-sub)' }}
        >
          Открыть страницу объекта на сайте
        </a>
      )}

      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        className={`w-full justify-center h-10 disabled:opacity-60 ${
          isPublished ? 'hp-btn-secondary' : 'hp-btn-primary'
        }`}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
        {isPublished ? 'Снять с сайта' : 'Опубликовать на сайте'}
      </button>

      <p className="text-xs leading-relaxed" style={{ color: 'var(--hp-tertiary)' }}>
        Опубликованный объект виден всем посетителям сайта. Данные собственника и
        служебные поля на сайт не передаются.
      </p>
    </div>
  )
}
