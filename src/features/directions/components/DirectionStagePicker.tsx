'use client'

import { useState } from 'react'
import { DIRECTIONS, stagesOf } from '@/features/directions/config/directions'

const radioCls =
  'flex items-center gap-2 p-2.5 rounded-[var(--hp-radius)] border border-[var(--hp-border)] cursor-pointer text-sm text-[var(--hp-ink)] transition-colors hover:border-[var(--hp-sub)] has-[:checked]:border-[var(--hp-accent)] has-[:checked]:bg-[var(--hp-accent-tint)]'

/**
 * Выбор направления работы и, при правке, её стадии.
 *
 * Клиентский, потому что список стадий зависит от выбранного направления:
 * у каждого из четырёх своя воронка, и показывать «Регистрацию перехода права»
 * в аренде — то же самое, что показывать «Заселение» в продаже.
 */
export function DirectionStagePicker({
  direction,
  status,
  showStatus = false,
}: {
  direction?: string | null
  status?: string | null
  showStatus?: boolean
}) {
  const [selected, setSelected] = useState(direction ?? 'rent_agent')
  const stages = stagesOf(selected)

  return (
    <>
      <div className="hp-card p-5 space-y-4">
        <h2 className="hp-h2">Направление работы</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {DIRECTIONS.map(d => (
            <label key={d.value} className={radioCls}>
              <input
                type="radio" name="deal_type" value={d.value}
                checked={selected === d.value}
                onChange={() => setSelected(d.value)}
                className="w-4 h-4 shrink-0 accent-[var(--hp-accent)]"
              />
              <span className="min-w-0">
                {d.label}
                <span className="block text-xs text-[var(--hp-sub)]">{d.description}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {showStatus && (
        <div className="hp-card p-5 space-y-4">
          <h2 className="hp-h2">Стадия</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {stages.map(s => (
              <label key={s.value} className={radioCls}>
                <input
                  type="radio" name="status" value={s.value}
                  defaultChecked={status === s.value}
                  className="w-4 h-4 shrink-0 accent-[var(--hp-accent)]"
                />
                {s.label}
              </label>
            ))}
          </div>
          <p className="text-xs text-[var(--hp-sub)]">
            Смена направления меняет и список стадий: воронки у направлений разные
          </p>
        </div>
      )}
    </>
  )
}
