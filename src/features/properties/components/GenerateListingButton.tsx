'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { GenerateListingDialog } from './GenerateListingDialog'
import type { ListingFact } from '@/lib/ai/listing/facts'

interface GenerateListingButtonProps {
  propertyId: string
  facts: ListingFact[]
  initialRawInput: string
}

/**
 * Кнопка «Сгенерировать объявление» в блоке «Описание» формы объекта.
 * Стоит внутри `<form>`, поэтому у всех кнопок модалки явный type="button":
 * иначе клик отправил бы форму объекта.
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
