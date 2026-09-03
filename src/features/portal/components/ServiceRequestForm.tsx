'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { createServiceRequestAction } from '@/features/portal/actions/requests.actions'
import { REQUEST_CATEGORIES } from '@/features/portal/config/request-categories'

/** Заявка на бытовую услугу из кабинета арендатора. */
export function ServiceRequestForm({ propertyId }: { propertyId: string }) {
  const [pending, start] = useTransition()
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="hp-btn-primary">
        <Plus style={{ width: 16, height: 16 }} />
        Оставить заявку
      </button>
    )
  }

  function submit(formData: FormData) {
    start(async () => {
      const res = await createServiceRequestAction(formData)
      if (res.error) toast.error(res.error)
      else {
        toast.success('Заявка принята — менеджер свяжется с вами')
        setOpen(false)
      }
    })
  }

  return (
    <form action={submit} className="hp-card p-5 space-y-4">
      <input type="hidden" name="property_id" value={propertyId} />

      <div className="space-y-1.5">
        <label className="hp-label" htmlFor="category">Что случилось</label>
        <select id="category" name="category" className="hp-input">
          {REQUEST_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="hp-label" htmlFor="description">Опишите подробнее</label>
        <textarea
          id="description" name="description" rows={4} required minLength={5}
          placeholder="Течёт смеситель на кухне, вода капает постоянно"
          className="hp-input"
        />
        <p className="text-xs text-[var(--hp-sub)]">
          Чем подробнее, тем точнее мастер приедет с нужным инструментом
        </p>
      </div>

      <div className="flex flex-wrap gap-2 shrink-0">
        <button type="submit" disabled={pending} className="hp-btn-primary">
          {pending ? 'Отправляем…' : 'Отправить заявку'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="hp-btn-secondary">Отмена</button>
      </div>
    </form>
  )
}
