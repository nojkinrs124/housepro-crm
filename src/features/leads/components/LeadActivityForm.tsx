'use client'

import { useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { addLeadActivityAction } from '@/features/leads/actions/leads.actions'

const activityTypes = [
  { value: 'call',     label: 'Звонок' },
  { value: 'message',  label: 'Сообщение' },
  { value: 'meeting',  label: 'Встреча' },
  { value: 'showing',  label: 'Показ' },
  { value: 'note',     label: 'Заметка' },
  { value: 'email',    label: 'Email' },
]

export function LeadActivityForm({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    formData.append('lead_id', leadId)
    const res = await addLeadActivityAction(formData)
    setLoading(false)
    if (res?.error) {
      setError(res.error)
    } else {
      setOpen(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-border rounded-xl text-sm text-muted-foreground hover:border-primary hover:text-primary transition-all"
      >
        <Plus className="w-4 h-4" />
        Добавить активность
      </button>
    )
  }

  return (
    <form action={handleSubmit} className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
      {/* Тип */}
      <div className="flex flex-wrap gap-1.5">
        {activityTypes.map(t => (
          <label key={t.value}
            className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border rounded-lg cursor-pointer text-xs hover:bg-accent transition has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary">
            <input type="radio" name="type" value={t.value} required className="sr-only" />
            {t.label}
          </label>
        ))}
      </div>

      {/* Описание */}
      <textarea name="content" rows={2}
        placeholder="Описание — что обсудили, о чём договорились..."
        className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none"
      />

      {/* Результат */}
      <input name="result" type="text"
        placeholder="Результат (необязательно)"
        className="w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
      />

      {/* Следующий контакт */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground shrink-0">След. контакт:</label>
        <input name="scheduled_at" type="datetime-local"
          className="flex-1 min-w-0 h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={loading}
          className="flex items-center gap-1.5 px-4 h-10 text-white rounded-[14px] text-sm font-bold hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 transition-all"
          style={{ background: 'var(--hp-gradient-primary)', boxShadow: '0 4px 16px rgba(22,163,74,0.35)' }}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Сохранить
        </button>
        <button type="button" onClick={() => setOpen(false)}
          className="px-4 h-10 border border-border rounded-[14px] text-sm font-medium hover:bg-accent transition-all">
          Отмена
        </button>
      </div>
    </form>
  )
}
