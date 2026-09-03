'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Check, Loader2 } from 'lucide-react'
import { toggleChecklistItemAction } from '@/features/directions/actions/stages.actions'
import { checklistFor } from '@/features/directions/config/stage-checklists'
import { stageLabel } from '@/features/directions/config/directions'

/**
 * Чек-лист текущей стадии сделки: что нужно сделать, чтобы её закрыть.
 *
 * Отличие от предусловий: предусловие система проверяет сама (подписан ли
 * договор, загружены ли фотографии), а пункт чек-листа — действие в реальном
 * мире, о котором система узнать не может. Обязательные пункты не дают уйти на
 * следующую стадию.
 */
export function StageChecklist({
  dealId,
  direction,
  stage,
  progress,
}: {
  dealId: string
  direction: string
  stage: string
  progress: Record<string, string[]>
}) {
  const [done, setDone] = useState<Set<string>>(new Set(progress[stage] ?? []))
  const [pending, start] = useTransition()

  const items = checklistFor(direction, stage)
  if (items.length === 0) return null

  const requiredLeft = items.filter(i => i.required && !done.has(i.code)).length

  function toggle(code: string) {
    if (pending) return
    const next = new Set(done)
    const isDone = next.has(code)
    if (isDone) next.delete(code)
    else next.add(code)
    setDone(next)

    start(async () => {
      const res = await toggleChecklistItemAction(dealId, stage, code, !isDone)
      if (res.error) {
        // Откатываем отметку: расхождение экрана с базой хуже, чем отказ.
        setDone(prev => {
          const rollback = new Set(prev)
          if (isDone) rollback.add(code)
          else rollback.delete(code)
          return rollback
        })
        toast.error(res.error)
      }
    })
  }

  return (
    <div className="hp-block">
      <div className="hp-block-header flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          Стадия «{stageLabel(direction, stage)}»
          {pending && <Loader2 className="w-3 h-3 animate-spin" />}
        </span>
        <span className={`hp-badge ${requiredLeft === 0 ? 'hp-badge-good' : 'hp-badge-warn'}`}>
          {requiredLeft === 0 ? 'Можно двигать дальше' : `Осталось: ${requiredLeft}`}
        </span>
      </div>

      <div className="p-4 space-y-2">
        {items.map(item => {
          const isDone = done.has(item.code)
          return (
            <button
              key={item.code}
              type="button"
              onClick={() => toggle(item.code)}
              disabled={pending}
              className="w-full flex items-start gap-3 p-2.5 text-left rounded-[var(--hp-radius)] border border-[var(--hp-border)] transition-colors hover:border-[var(--hp-sub)] disabled:opacity-60"
            >
              {/* Галочка акцентом на своём фоне, а не белым по заливке: цвет текста
                  поверх акцента пришлось бы задавать хексом, а палитра —
                  только токены. */}
              <span
                className={`w-4 h-4 mt-0.5 shrink-0 flex items-center justify-center border ${
                  isDone ? 'border-[var(--hp-accent)]' : 'border-[var(--hp-border)]'
                }`}
              >
                {isDone && <Check className="w-3 h-3 text-[var(--hp-accent)]" />}
              </span>
              <span className="min-w-0">
                <span className={`text-sm ${isDone ? 'text-[var(--hp-sub)] line-through' : 'text-[var(--hp-ink)]'}`}>
                  {item.title}
                </span>
                {item.required && !isDone && (
                  <span className="ml-2 text-[11px] text-[var(--hp-warn)]">обязательно</span>
                )}
                {item.hint && (
                  <span className="block text-xs text-[var(--hp-sub)] mt-0.5">{item.hint}</span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
