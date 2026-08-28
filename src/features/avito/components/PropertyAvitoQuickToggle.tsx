'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Megaphone, Loader2, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'
import { toggleAvitoPublishAction } from '@/features/avito/actions/avito.actions'
import type { AvitoPropertyStatus } from '@/types/database'

interface Props {
  propertyId: string
  isPublished: boolean
  status?: AvitoPropertyStatus | null
  eligible: boolean // status объекта === 'available'
}

const STATUS_UI: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  pending: { label: 'В очереди',  className: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  active:  { label: 'На Авито',   className: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle2 },
  error:   { label: 'Ошибка',     className: 'bg-red-50 text-red-700 border-red-200',       icon: AlertTriangle },
  removed: { label: 'Снят',       className: 'bg-slate-100 text-slate-600 border-slate-200', icon: AlertTriangle },
}

/**
 * Компактный переключатель публикации на Авито для карточки/строки в списке объектов.
 * Живёт внутри <Link> строки/карточки — обязательно stopPropagation+preventDefault,
 * иначе клик по нему ещё и уводит на страницу объекта.
 */
export function PropertyAvitoQuickToggle({ propertyId, isPublished, status, eligible }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // Нечего показывать: объект не опубликован и не может быть опубликован сейчас
  if (!isPublished && !eligible) return null

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setLoading(true)
    const res = await toggleAvitoPublishAction(propertyId, !isPublished)
    setLoading(false)
    if (res && 'error' in res && res.error) {
      toast.error(res.error)
      return
    }
    toast.success(isPublished ? 'Снято с публикации на Авито' : 'Поставлено в очередь на публикацию')
    router.refresh()
  }

  const ui = isPublished ? (status ? STATUS_UI[status] ?? STATUS_UI.pending : STATUS_UI.pending) : null
  const Icon = ui?.icon ?? Megaphone

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      title={isPublished ? 'Снять с публикации на Авито' : 'Опубликовать на Авито'}
      className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full font-bold border transition-all disabled:opacity-60 ${
        ui ? ui.className : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-600'
      }`}
    >
      {loading ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Icon className="w-2.5 h-2.5" />}
      {ui ? ui.label : 'На Авито'}
    </button>
  )
}
