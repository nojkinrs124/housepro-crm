'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { saveRegulationAction, deleteRegulationAction } from '@/features/management/actions/regulations.actions'
import { PERIOD_LABELS, type RegulationPeriod } from '@/features/management/services/regulation.service'

export interface RegulationRow {
  id: string
  code: string
  title: string
  description: string | null
  period: string
  dayOfMonth: number | null
  leadDays: number
  priority: string
  isActive: boolean
  sortOrder: number
}

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Низкий',
  medium: 'Обычный',
  high: 'Высокий',
}

/**
 * Регламент тарифа: что и когда делается по объекту в управлении.
 *
 * Клиентский, потому что день месяца исчезает у правил «по событию»: у них срок
 * берётся из данных (окончание договора найма), и предлагать выбрать число
 * значило бы приглашать заполнить бессмыслицу.
 */
export function RegulationEditor({ planId, regulations }: { planId: string; regulations: RegulationRow[] }) {
  const [pending, start] = useTransition()
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  function submit(formData: FormData) {
    start(async () => {
      const res = await saveRegulationAction(formData)
      if (res.error) toast.error(res.error)
      else {
        toast.success('Правило сохранено')
        setEditing(null)
        setAdding(false)
      }
    })
  }

  function remove(id: string, title: string) {
    if (!confirm(`Удалить правило «${title}»? Уже созданные по нему задачи останутся.`)) return
    start(async () => {
      const res = await deleteRegulationAction(id)
      if (res.error) toast.error(res.error)
      else toast.success('Правило удалено')
    })
  }

  return (
    <div className="space-y-4">
      {regulations.map(r => (
        <div key={r.id} className="hp-block">
          <div className="hp-block-header flex items-center justify-between gap-2 flex-wrap">
            <span className="flex items-center gap-2">
              {r.title}
              {!r.isActive && <span className="hp-badge hp-badge-neutral">Выключено</span>}
            </span>
            <span className="flex flex-wrap gap-2 shrink-0">
              <button type="button" onClick={() => setEditing(editing === r.id ? null : r.id)} className="hp-btn-secondary">
                {editing === r.id ? 'Свернуть' : 'Изменить'}
              </button>
              <button type="button" onClick={() => remove(r.id, r.title)} disabled={pending} className="hp-btn-secondary">
                <Trash2 style={{ width: 14, height: 14 }} />
              </button>
            </span>
          </div>

          {editing === r.id ? (
            <RegulationFields planId={planId} row={r} pending={pending} onSubmit={submit} />
          ) : (
            <>
              <div className="hp-block-row">
                <span className="label">Периодичность</span>
                <span className="value">
                  {PERIOD_LABELS[r.period as RegulationPeriod] ?? r.period}
                  {r.dayOfMonth != null && `, ${r.dayOfMonth}-го числа`}
                </span>
              </div>
              <div className="hp-block-row">
                <span className="label">Задача заводится</span>
                <span className="value">
                  {r.leadDays === 0 ? 'в день срока' : `за ${r.leadDays} дн. до срока`}
                </span>
              </div>
              <div className="hp-block-row">
                <span className="label">Приоритет</span>
                <span className="value">{PRIORITY_LABELS[r.priority] ?? r.priority}</span>
              </div>
              {r.description && (
                <div className="hp-block-row">
                  <span className="label">Описание</span>
                  <span className="value">{r.description}</span>
                </div>
              )}
            </>
          )}
        </div>
      ))}

      {adding ? (
        <div className="hp-block">
          <div className="hp-block-header">Новое правило</div>
          <RegulationFields planId={planId} row={null} pending={pending} onSubmit={submit} />
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="hp-btn-secondary">
          <Plus style={{ width: 16, height: 16 }} />
          Добавить правило
        </button>
      )}
    </div>
  )
}

function RegulationFields({
  planId,
  row,
  pending,
  onSubmit,
}: {
  planId: string
  row: RegulationRow | null
  pending: boolean
  onSubmit: (formData: FormData) => void
}) {
  const [period, setPeriod] = useState(row?.period ?? 'monthly')

  return (
    <form action={onSubmit} className="p-[18px] space-y-4">
      <input type="hidden" name="plan_id" value={planId} />
      {row && <input type="hidden" name="id" value={row.id} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="hp-label">Название</label>
          <input name="title" required defaultValue={row?.title ?? ''}
            placeholder="Снять показания счётчиков" className="hp-input" />
          <p className="text-xs text-[var(--hp-sub)]">Станет заголовком задачи</p>
        </div>

        {!row && (
          <div className="space-y-1.5">
            <label className="hp-label">Код</label>
            <input name="code" required placeholder="meter_reading" className="hp-input" />
            <p className="text-xs text-[var(--hp-sub)]">
              По нему находятся уже созданные задачи — потом не меняется
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="space-y-1.5">
          <label className="hp-label">Периодичность</label>
          <select name="period" value={period} onChange={e => setPeriod(e.target.value)} className="hp-input">
            {Object.entries(PERIOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {period !== 'on_event' && (
          <div className="space-y-1.5">
            <label className="hp-label">День месяца</label>
            <input name="day_of_month" type="number" min="1" max="28" required
              defaultValue={row?.dayOfMonth ?? 5} className="hp-input" />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="hp-label">Заранее, дней</label>
          <input name="lead_days" type="number" min="0" max="90"
            defaultValue={row?.leadDays ?? 0} className="hp-input" />
        </div>

        <div className="space-y-1.5">
          <label className="hp-label">Приоритет</label>
          <select name="priority" defaultValue={row?.priority ?? 'medium'} className="hp-input">
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {period === 'on_event' && (
        <p className="text-xs text-[var(--hp-sub)]">
          Срок берётся из данных — из даты окончания договора найма, а не из числа месяца
        </p>
      )}

      <div className="space-y-1.5">
        <label className="hp-label">Описание</label>
        <textarea name="description" rows={2} defaultValue={row?.description ?? ''} className="hp-input" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
        <div className="space-y-1.5">
          <label className="hp-label">Порядок</label>
          <input name="sort_order" type="number" step="10" defaultValue={row?.sortOrder ?? 0} className="hp-input" />
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--hp-ink)] pb-2">
          <input type="checkbox" name="is_active" defaultChecked={row?.isActive ?? true} />
          Правило действует
        </label>
      </div>

      <button type="submit" disabled={pending} className="hp-btn-primary">
        {pending ? 'Сохраняем…' : 'Сохранить правило'}
      </button>
    </form>
  )
}
