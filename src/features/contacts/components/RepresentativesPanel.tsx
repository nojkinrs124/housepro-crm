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
    <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <UserCircle2 className="w-4 h-4" />
          Представители
        </h2>
        <button onClick={() => setShowForm(v => !v)} className="text-xs text-primary hover:underline flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" />
          {showForm ? 'Скрыть' : 'Добавить'}
        </button>
      </div>

      {deleteError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 mb-3">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {deleteError}
        </div>
      )}

      {representatives.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground">Представители не добавлены</p>
      )}

      {representatives.length > 0 && (
        <div className="space-y-2 mb-3">
          {representatives.map(r => (
            <div key={r.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {r.full_name}{r.is_primary ? ' · основной' : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[r.position, basisLabels[r.basis_type] ?? r.basis_type, r.basis_details].filter(Boolean).join(' · ')}
                </p>
                {(r.phone || r.email) && (
                  <p className="text-xs text-muted-foreground">{[r.phone, r.email].filter(Boolean).join(' · ')}</p>
                )}
              </div>
              <button onClick={() => handleDelete(r.id)} className="text-red-500 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <ServerActionForm action={addRepresentativeAction} className="space-y-3 pt-3 border-t border-slate-100">
          <input type="hidden" name="contact_id" value={contactId} />
          <div>
            <label className="text-xs font-medium text-foreground">ФИО *</label>
            <input name="full_name" required
              className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-foreground">Должность</label>
              <input name="position" placeholder="Генеральный директор"
                className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground">Телефон</label>
              <input name="phone"
                className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground">Email</label>
            <input name="email" type="email"
              className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-foreground">Основание</label>
              <select name="basis_type" defaultValue="power_of_attorney"
                className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer">
                <option value="charter">Устав</option>
                <option value="power_of_attorney">Доверенность</option>
                <option value="other">Иное</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground">Реквизиты основания</label>
              <input name="basis_details" placeholder="№ 12 от 01.03.2026"
                className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-foreground">
            <input type="checkbox" name="is_primary" className="accent-primary" />
            Основной представитель (подставляется в договоры по умолчанию)
          </label>
          <button type="submit"
            className="px-4 py-2 rounded-lg text-white text-xs font-medium hover:-translate-y-0.5 transition"
            style={{ background: 'var(--hp-gradient-primary)' }}>
            Сохранить представителя
          </button>
        </ServerActionForm>
      )}
    </div>
  )
}
