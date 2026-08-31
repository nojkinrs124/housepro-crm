'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Globe, Loader2 } from 'lucide-react'
import { togglePropertySitePublishAction } from '@/features/properties/actions/site-publish.actions'

/**
 * Компактный переключатель «на сайте» для строки/карточки в списке объектов.
 * Живёт внутри <Link> — обязательны preventDefault + stopPropagation, иначе
 * клик по кнопке ещё и уводит на страницу объекта.
 */
export function PropertySiteQuickToggle({
  propertyId,
  isPublished,
}: {
  propertyId: string
  isPublished: boolean
}) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setLoading(true)
    const res = await togglePropertySitePublishAction(propertyId, !isPublished)
    setLoading(false)

    if (res && 'error' in res && res.error) {
      toast.error(res.error)
      return
    }
    toast.success(isPublished ? 'Снято с публикации на сайте' : 'Опубликовано на сайте')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      title={isPublished ? 'Снять с публикации на сайте' : 'Опубликовать на сайте'}
      className="inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 font-bold border transition-colors disabled:opacity-60"
      style={{
        borderRadius: 'var(--hp-radius)',
        background: isPublished ? 'var(--hp-good-tint)' : 'var(--hp-surface)',
        borderColor: isPublished ? 'var(--hp-good-tint)' : 'var(--hp-border)',
        color: isPublished ? 'var(--hp-good)' : 'var(--hp-sub)',
      }}
    >
      {loading ? (
        <Loader2 className="w-2.5 h-2.5 animate-spin" />
      ) : (
        <Globe className="w-2.5 h-2.5" />
      )}
      {isPublished ? 'На сайте' : 'На сайт'}
    </button>
  )
}
