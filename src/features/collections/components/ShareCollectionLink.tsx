'use client'

import { useState, useTransition } from 'react'
import { Check, Copy, Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { markCollectionSentManuallyAction } from '../actions/collections.actions'

/**
 * Ссылку на подборку риелтор чаще отправляет в мессенджер, а не письмом.
 * Кнопка копирует ссылку и отмечает подборку отправленной — это та же веха
 * сделки, что и письмо (QA 28.10.2026, D-14, D-17).
 */
export function ShareCollectionLink({ collectionId, shareUrl, sentAt }: {
  collectionId: string
  shareUrl: string
  sentAt: string | null
}) {
  const [isPending, startTransition] = useTransition()
  const [copied, setCopied] = useState(false)

  const copyAndMark = () => startTransition(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
    } catch {
      // Буфер обмена недоступен (не https) — ссылку видно рядом, её можно выделить.
    }
    const result = await markCollectionSentManuallyAction(collectionId)
    if (result && 'error' in result && result.error) toast.error(result.error)
    else toast.success('Ссылка скопирована, подборка отмечена отправленной')
  })

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={copyAndMark} disabled={isPending} className="hp-btn-secondary shrink-0 disabled:opacity-60">
        {isPending
          ? <Loader2 strokeWidth={1.6} className="w-4 h-4 animate-spin" />
          : copied ? <Check strokeWidth={1.6} className="w-4 h-4" /> : <Copy strokeWidth={1.6} className="w-4 h-4" />}
        Скопировать ссылку и отметить отправленной
      </button>
      <span className="text-[12.5px] text-[var(--hp-sub)] flex items-center gap-1.5">
        <Send strokeWidth={1.6} className="w-3.5 h-3.5" />
        {sentAt
          ? `Отправлена ${new Date(sentAt).toLocaleDateString('ru-RU')}`
          : 'Ещё не отправлена — отправьте ссылку в мессенджер или письмом ниже'}
      </span>
    </div>
  )
}
