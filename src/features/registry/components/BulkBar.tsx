'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronDown, Trash2, X } from 'lucide-react'
import { REGISTRIES, plural, type RegistryKey } from '@/features/registry/config/registries'
import {
  bulkUpdateAction, bulkDeleteAction, listAssigneesAction,
} from '@/features/registry/actions/registry.actions'
import type { Selection } from '@/hooks/useSelection'

/**
 * Панель групповых действий над выделенными строками — одна на все реестры.
 * Состав кнопок задаёт REGISTRIES: где нет колонки статуса, нет и меню статуса;
 * сотрудников нельзя удалять пачкой, поэтому у них нет кнопки удаления.
 */
export function BulkBar({ registry, selection }: { registry: RegistryKey; selection: Selection }) {
  const def = REGISTRIES[registry]
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [openMenu, setOpenMenu] = useState<'status' | 'assignee' | null>(null)
  const [assignees, setAssignees] = useState<{ id: string; full_name: string }[] | null>(null)

  if (selection.count === 0) return null

  const label = plural(selection.count, def.nouns)

  function run(fn: () => Promise<{ error?: string; count?: number }>, done: string) {
    setOpenMenu(null)
    startTransition(async () => {
      const res = await fn()
      if (res.error) { toast.error(res.error); return }
      toast.success(`${done}: ${plural(res.count ?? 0, def.nouns)}`)
      selection.clear()
      router.refresh()
    })
  }

  async function openAssignees() {
    setOpenMenu(openMenu === 'assignee' ? null : 'assignee')
    if (assignees === null) setAssignees(await listAssigneesAction())
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5 p-3 bg-[var(--hp-accent-tint)] border border-[var(--hp-border)]">
      <span className="text-[12.5px] font-semibold text-[var(--hp-ink)]">Выбрано: {label}</span>

      {def.statuses && (
        <div className="relative">
          <button onClick={() => setOpenMenu(openMenu === 'status' ? null : 'status')}
            disabled={pending} className="hp-chip">
            {def.statusIsBoolean ? 'Доступ' : 'Статус'}
            <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${openMenu === 'status' ? 'rotate-180' : ''}`} />
          </button>
          {openMenu === 'status' && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(null)} />
              <div className="absolute top-full mt-1.5 left-0 z-50 bg-[var(--hp-surface)] border border-[var(--hp-border)] rounded-[var(--hp-radius)] py-1 min-w-[180px]">
                {def.statuses.map(opt => (
                  <button key={opt.value}
                    onClick={() => run(
                      () => bulkUpdateAction(registry, selection.selected, { status: opt.value }),
                      `Статус «${opt.label}»`,
                    )}
                    className="w-full text-left px-3.5 py-2 text-[12.5px] text-[var(--hp-sub)] hover:bg-[var(--hp-neutral-tint)] transition-colors">
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {def.assigneeColumn && (
        <div className="relative">
          <button onClick={openAssignees} disabled={pending} className="hp-chip">
            Ответственный
            <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${openMenu === 'assignee' ? 'rotate-180' : ''}`} />
          </button>
          {openMenu === 'assignee' && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(null)} />
              <div className="absolute top-full mt-1.5 left-0 z-50 bg-[var(--hp-surface)] border border-[var(--hp-border)] rounded-[var(--hp-radius)] py-1 min-w-[200px] max-h-72 overflow-y-auto">
                {assignees === null ? (
                  <p className="px-3.5 py-2 text-[12.5px] text-[var(--hp-tertiary)]">Загрузка…</p>
                ) : (
                  <>
                    {assignees.map(u => (
                      <button key={u.id}
                        onClick={() => run(
                          () => bulkUpdateAction(registry, selection.selected, { assignee: u.id }),
                          `Ответственный — ${u.full_name}`,
                        )}
                        className="w-full text-left px-3.5 py-2 text-[12.5px] text-[var(--hp-sub)] hover:bg-[var(--hp-neutral-tint)] transition-colors">
                        {u.full_name}
                      </button>
                    ))}
                    <button
                      onClick={() => run(
                        () => bulkUpdateAction(registry, selection.selected, { assignee: null }),
                        'Ответственный снят',
                      )}
                      className="w-full text-left px-3.5 py-2 text-[12.5px] text-[var(--hp-tertiary)] hover:bg-[var(--hp-neutral-tint)] transition-colors">
                      Снять ответственного
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {def.deletable !== false && (
        <button
          disabled={pending}
          onClick={() => {
            if (!confirm(`Удалить ${label}? Это действие нельзя отменить.`)) return
            run(() => bulkDeleteAction(registry, selection.selected), 'Удалено')
          }}
          className="hp-chip text-[var(--hp-danger)] hover:text-[var(--hp-danger)]">
          <Trash2 className="w-3.5 h-3.5 shrink-0" />
          Удалить
        </button>
      )}

      <button onClick={selection.clear}
        className="flex items-center gap-1.5 px-2 h-[34px] text-[12.5px] font-medium text-[var(--hp-sub)] hover:text-[var(--hp-ink)] transition-colors">
        <X className="w-3.5 h-3.5" />
        Снять выделение
      </button>
    </div>
  )
}
