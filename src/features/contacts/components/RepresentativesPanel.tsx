'use client'

import { useState } from 'react'
import { Trash2, Plus, UserCircle2, AlertCircle } from 'lucide-react'
import { addRepresentativeAction, deleteRepresentativeAction } from '@/features/contacts/actions/contacts.actions'
import { ServerActionForm } from '@/components/forms/ServerActionForm'

interface Representative {
  id: string
  full_name: string
  position: string | null
  phone: string | null
  email: string | null
  basis_type: string
  basis_details: string | null
  is_primary: boolean | null
}

const basisLabels: Record<string, string> = {
  charter: 'Устав',
  power_of_attorney: 'Доверенность',
  other: 'Иное',
}

export function RepresentativesPanel({ contactId, representatives }: { contactId: string; representatives: Representative[] }) {
  const [showForm, setShowForm] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleDelete(repId: string) {
    if (!confirm('Удалить представителя?')) return
    setDeleteError(null)
    const result = await deleteRepresentativeAction(repId, contactId)
    if (result?.error) setDeleteError(result.error)
  }

  return (
    <div className="hp-block">
      <div className="hp-block-header flex items-center justify-between normal-case tracking-normal text-[13px] font-semibold text-[var(--hp-ink)]">
        <span className="flex items-center gap-2"><UserCircle2 className="w-4 h-4" />Представители</span>
        <button onClick={() => setShowForm(v => !v)} className="text-xs font-semibold text-[var(--hp-accent)] hover:underline flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" />
          {showForm ? 'Скрыть' : 'Добавить'}
        </button>
      </div>

      {deleteError && (
        <div className="flex items-center gap-2 border-b border-[var(--hp-border-soft)] bg-[var(--hp-danger-tint)] px-[18px] py-2.5 text-xs text-[var(--hp-danger)]">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {deleteError}
        </div>
      )}

      {representatives.length === 0 && !showForm && (
        <div className="hp-block-row"><span className="label">Представители не добавлены</span></div>
      )}

      {representatives.map(r => (
        <div key={r.id} className="hp-block-row items-start">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--hp-ink)]">
              {r.full_name}{r.is_primary ? ' · основной' : ''}
            </p>
            <p className="text-xs text-[var(--hp-sub)] mt-0.5">
              {[r.position, basisLabels[r.basis_type] ?? r.basis_type, r.basis_details].filter(Boolean).join(' · ')}
            </p>
            {(r.phone || r.email) && (
              <p className="text-xs text-[var(--hp-sub)]">{[r.phone, r.email].filter(Boolean).join(' · ')}</p>
            )}
          </div>
          <button onClick={() => handleDelete(r.id)} className="text-[var(--hp-danger)] p-1.5 rounded-[var(--hp-radius)] hover:bg-[var(--hp-danger-tint)] transition-colors shrink-0">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}

      {showForm && (
        <ServerActionForm action={addRepresentativeAction} className="space-y-3 p-[18px] border-t border-[var(--hp-border)]">
          <input type="hidden" name="contact_id" value={contactId} />
          <div>
            <label className="text-xs font-medium text-foreground">ФИО *</label>
            <input name="full_name" required
              className="w-full h-9 px-3 rounded-[var(--hp-radius)] border border-[var(--hp-border)] bg-[var(--hp-surface)] text-sm mt-1 outline-none focus:border-[var(--hp-ink)] transition-colors" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-foreground">Должность</label>
              <input name="position" placeholder="Генеральный директор"
                className="w-full h-9 px-3 rounded-[var(--hp-radius)] border border-[var(--hp-border)] bg-[var(--hp-surface)] text-sm mt-1 outline-none focus:border-[var(--hp-ink)] transition-colors" />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground">Телефон</label>
              <input name="phone"
                className="w-full h-9 px-3 rounded-[var(--hp-radius)] border border-[var(--hp-border)] bg-[var(--hp-surface)] text-sm mt-1 outline-none focus:border-[var(--hp-ink)] transition-colors" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground">Email</label>
            <input name="email" type="email"
              className="w-full h-9 px-3 rounded-[var(--hp-radius)] border border-[var(--hp-border)] bg-[var(--hp-surface)] text-sm mt-1 outline-none focus:border-[var(--hp-ink)] transition-colors" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-foreground">Основание</label>
              <select name="basis_type" defaultValue="power_of_attorney"
                className="w-full h-9 px-3 rounded-[var(--hp-radius)] border border-[var(--hp-border)] bg-[var(--hp-surface)] text-sm mt-1 outline-none focus:border-[var(--hp-ink)] transition-colors cursor-pointer">
                <option value="charter">Устав</option>
                <option value="power_of_attorney">Доверенность</option>
                <option value="other">Иное</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground">Реквизиты основания</label>
              <input name="basis_details" placeholder="№ 12 от 01.03.2026"
                className="w-full h-9 px-3 rounded-[var(--hp-radius)] border border-[var(--hp-border)] bg-[var(--hp-surface)] text-sm mt-1 outline-none focus:border-[var(--hp-ink)] transition-colors" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-foreground">
            <input type="checkbox" name="is_primary" className="accent-primary" />
            Основной представитель (подставляется в договоры по умолчанию)
          </label>
          <button type="submit"
            className="px-4 py-2 rounded-[var(--hp-radius)] text-white text-xs font-semibold transition-colors bg-[var(--hp-accent)] hover:bg-[var(--hp-accent-hover)]">
            Сохранить представителя
          </button>
        </ServerActionForm>
      )}
    </div>
  )
}
