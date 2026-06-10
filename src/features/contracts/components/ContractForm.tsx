'use client'

import { useActionState } from 'react'
import { FileText, Building2, User, Home, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const contractTypes = [
  { value: 'rent_apartment',      label: '🏠 Аренда квартиры' },
  { value: 'rent_commercial',     label: '🏢 Коммерческая аренда' },
  { value: 'sale_apartment',      label: '💰 Продажа квартиры' },
  { value: 'sale_house',          label: '🏡 Продажа дома' },
  { value: 'property_management', label: '⚙️ Управление' },
  { value: 'sublease',            label: '🔄 Субаренда' },
  { value: 'agency_contract',     label: '📋 Агентский' },
]

const statusOptions = [
  { value: 'draft',     label: 'Черновик' },
  { value: 'generated', label: 'Создан' },
  { value: 'signed',    label: 'Подписан' },
  { value: 'completed', label: 'Завершён' },
  { value: 'cancelled', label: 'Отменён' },
]

interface Contact { id: string; full_name: string; phone?: string | null }
interface Property { id: string; title: string; address?: string | null }

interface ContractFormProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: (prevState: any, formData: FormData) => Promise<{ error?: string }>
  owners: Contact[]
  clients: Contact[]
  properties: Property[]
  backHref: string
  submitLabel: string
  mode: 'create' | 'edit'
  defaults?: {
    contract_type?: string
    owner_contact_id?: string
    client_contact_id?: string
    property_id?: string
    amount?: number | null
    deposit?: number | null
    start_date?: string | null
    end_date?: string | null
    notes?: string | null
    status?: string
  }
}

export function ContractForm({
  action, owners, clients, properties, backHref, submitLabel, mode, defaults = {}
}: ContractFormProps) {
  const [state, formAction, isPending] = useActionState(action, { error: undefined })

  const inp = 'w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all'
  const sel = 'w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer'
  const lbl = 'block text-sm font-medium text-foreground mb-1.5'

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-xl px-4 py-3 text-sm">
          {state.error}
        </div>
      )}

      {/* Тип договора */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-foreground">Тип договора</h2>
        <div className="grid grid-cols-2 gap-2.5">
          {contractTypes.map(t => (
            <label key={t.value}
              className="flex items-center gap-3 p-3 border border-border rounded-xl cursor-pointer hover:bg-accent transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5 text-sm">
              <input type="radio" name="contract_type" value={t.value}
                defaultChecked={(defaults.contract_type ?? 'rent_apartment') === t.value}
                className="accent-primary shrink-0" />
              {t.label}
            </label>
          ))}
        </div>
      </div>

      {/* Статус (только для edit) */}
      {mode === 'edit' && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
          <h2 className="font-semibold text-foreground">Статус</h2>
          <select name="status" defaultValue={defaults.status ?? 'draft'} className={sel}>
            {statusOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Стороны */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
        <h2 className="font-semibold text-foreground">Стороны договора</h2>

        <div className="space-y-1.5">
          <label className={lbl + ' flex items-center gap-2'}>
            <Building2 className="w-4 h-4 text-orange-500" />
            Собственник — Сторона 1
          </label>
          <select name="owner_contact_id" defaultValue={defaults.owner_contact_id ?? ''} className={sel}>
            <option value="">Выберите собственника</option>
            {owners.map(o => (
              <option key={o.id} value={o.id}>{o.full_name}{o.phone ? ` · ${o.phone}` : ''}</option>
            ))}
          </select>
          {owners.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Нет контактов с ролью «Собственник».{' '}
              <Link href="/contacts/new" className="text-primary hover:underline">Добавить →</Link>
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className={lbl + ' flex items-center gap-2'}>
            <User className="w-4 h-4 text-blue-500" />
            Клиент — Сторона 2
          </label>
          <select name="client_contact_id" defaultValue={defaults.client_contact_id ?? ''} className={sel}>
            <option value="">Выберите клиента</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.full_name}{c.phone ? ` · ${c.phone}` : ''}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className={lbl + ' flex items-center gap-2'}>
            <Home className="w-4 h-4 text-emerald-500" />
            Объект
          </label>
          <div className="flex items-center gap-2">
            <select name="property_id" defaultValue={defaults.property_id ?? ''} className={sel + ' flex-1'}>
              <option value="">Выберите объект</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>{p.title}{p.address ? ` — ${p.address}` : ''}</option>
              ))}
            </select>
            <Link href="/properties/new" target="_blank"
              className="h-10 px-3 rounded-xl border border-primary/30 text-primary text-sm font-medium hover:bg-primary/10 transition flex items-center gap-1 whitespace-nowrap">
              <Home className="w-4 h-4" />
              Создать
            </Link>
          </div>
        </div>
      </div>

      {/* Финансы и сроки */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
        <h2 className="font-semibold text-foreground">Финансы и сроки</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={lbl}>Сумма (₽)</label>
            <input name="amount" type="number" placeholder="50 000"
              defaultValue={defaults.amount ?? ''} className={inp} />
          </div>
          <div className="space-y-1.5">
            <label className={lbl}>Залог (₽)</label>
            <input name="deposit" type="number" placeholder="50 000"
              defaultValue={defaults.deposit ?? ''} className={inp} />
          </div>
          <div className="space-y-1.5">
            <label className={lbl}>Дата начала</label>
            <input name="start_date" type="date"
              defaultValue={defaults.start_date ? defaults.start_date.slice(0, 10) : ''} className={inp} />
          </div>
          <div className="space-y-1.5">
            <label className={lbl}>Дата окончания</label>
            <input name="end_date" type="date"
              defaultValue={defaults.end_date ? defaults.end_date.slice(0, 10) : ''} className={inp} />
          </div>
        </div>
      </div>

      {/* Примечания */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
        <h2 className="font-semibold text-foreground">Примечания</h2>
        <textarea name="notes" rows={3} placeholder="Дополнительные условия..."
          defaultValue={defaults.notes ?? ''}
          className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={isPending}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all disabled:opacity-60">
          <FileText className="w-4 h-4" />
          {isPending ? 'Сохранение...' : submitLabel}
        </button>
        <Link href={backHref}
          className="px-6 py-2.5 border border-border text-foreground rounded-xl text-sm font-medium hover:bg-accent transition-all">
          Отмена
        </Link>
      </div>
    </form>
  )
}
