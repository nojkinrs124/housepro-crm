'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Check, Copy, Sparkles } from 'lucide-react'
import { GenerateListingDialog } from './GenerateListingDialog'
import type { ListingFact } from '@/lib/ai/listing/facts'

interface GenerateListingButtonProps {
  propertyId: string
  facts: ListingFact[]
  initialRawInput: string
}

/**
 * Кнопка «Сгенерировать объявление» в карточке редактирования объекта.
 * Живёт вне `<form>` объекта: у кнопок внутри модалки по умолчанию type=submit,
 * и вложенный в форму <dialog> отправлял бы всю форму объекта.
 */
export function GenerateListingButton({ propertyId, facts, initialRawInput }: GenerateListingButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="hp-btn-primary">
        <Sparkles style={{ width: 14, height: 14 }} />
        Сгенерировать объявление
      </button>
      {open && (
        <GenerateListingDialog
          propertyId={propertyId}
          facts={facts}
          initialRawInput={initialRawInput}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

/** Копирует сохранённое объявление (заголовок + тело) — для вставки на площадку. */
export function CopyListingButton({ title, text }: { title: string | null; text: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(title ? `${title}\n\n${text}` : text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Не удалось скопировать — скопируйте текст вручную')
    }
  }

  return (
    <button type="button" onClick={copy} className="hp-btn-secondary">
      {copied ? <Check style={{ width: 14, height: 14 }} /> : <Copy style={{ width: 14, height: 14 }} />}
      {copied ? 'Скопировано' : 'Копировать'}
    </button>
  )
}
