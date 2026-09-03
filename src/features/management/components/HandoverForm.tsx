'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle2 } from 'lucide-react'
import { saveHandoverAction, completeHandoverAction } from '@/features/management/actions/handover.actions'

export interface HandoverDefaults {
  engagementId: string
  inventory: { title: string; condition?: string }[]
  documents: { title: string }[]
  conditionNote: string | null
  keysCount: number | null
  completedAt: string | null
}

/**
 * Акт приёма объекта в управление.
 *
 * Заполняется в несколько заходов: часть данных снимается на объекте с
 * телефона, часть дописывается в офисе. Поэтому «Сохранить» и «Закрыть акт» —
 * разные действия: закрытие проверяет полноту и после него обслуживание
 * считается запущенным.
 */
export function HandoverForm({ defaults, backHref }: { defaults: HandoverDefaults; backHref: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const closed = Boolean(defaults.completedAt)

  function save(formData: FormData) {
    start(async () => {
      const res = await saveHandoverAction(formData)
      if (res.error) toast.error(res.error)
      else toast.success('Акт сохранён')
    })
  }

  function complete() {
    start(async () => {
      const res = await completeHandoverAction(defaults.engagementId)
      if (res.error) toast.error(res.error)
      else {
        toast.success('Акт приёма закрыт, объект в обслуживании')
        router.push(backHref)
      }
    })
  }

  return (
    <div className="space-y-4">
      {closed && (
        <p className="hp-card p-3 text-sm text-[var(--hp-good)]">
          Акт закрыт {new Date(defaults.completedAt!).toLocaleDateString('ru-RU')}. Правки в него больше не вносятся.
        </p>
      )}

      <form action={save} className="space-y-4">
        <input type="hidden" name="engagement_id" value={defaults.engagementId} />

        <div className="hp-card p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="hp-label" htmlFor="inventory">Опись имущества</label>
            <textarea id="inventory" name="inventory" rows={8} className="hp-input" readOnly={closed}
              defaultValue={defaults.inventory.map(i => i.condition ? `${i.title} — ${i.condition}` : i.title).join('\n')}
              placeholder={'Холодильник Bosch — рабочий\nСтиральная машина LG — рабочая\nДиван — потёртость на левом подлокотнике'} />
            <p className="text-xs text-[var(--hp-sub)]">
              По одному предмету в строке, состояние после тире. Без описи не предъявить
              претензию, если что-то пропадёт или сломается
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="hp-label" htmlFor="keys_count">Передано ключей</label>
              <input id="keys_count" name="keys_count" type="number" min="0" className="hp-input" readOnly={closed}
                defaultValue={defaults.keysCount ?? ''} placeholder="2" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="hp-label" htmlFor="condition_note">Состояние объекта</label>
            <textarea id="condition_note" name="condition_note" rows={3} className="hp-input" readOnly={closed}
              defaultValue={defaults.conditionNote ?? ''}
              placeholder="Ремонт свежий, окна ПВХ, требуется замена смесителя в ванной" />
          </div>

          <div className="space-y-1.5">
            <label className="hp-label" htmlFor="documents">Полученные документы</label>
            <textarea id="documents" name="documents" rows={4} className="hp-input" readOnly={closed}
              defaultValue={defaults.documents.map(d => d.title).join('\n')}
              placeholder={'Выписка ЕГРН\nКопия паспорта собственника\nКвитанции об оплате ЖКУ'} />
          </div>
        </div>

        {!closed && (
          <div className="flex flex-wrap gap-2 shrink-0">
            <button type="submit" disabled={pending} className="hp-btn-secondary">
              {pending ? 'Сохраняем…' : 'Сохранить'}
            </button>
            <Link href={backHref} className="hp-btn-secondary">Назад</Link>
          </div>
        )}
      </form>

      {!closed && (
        <div className="hp-card p-5 space-y-3">
          <p className="text-sm text-[var(--hp-ink)] font-semibold">Закрыть акт приёма</p>
          <p className="text-xs text-[var(--hp-sub)]">
            После закрытия обслуживание переходит в рабочее состояние. Закрыть можно, когда
            заполнена опись, указано число ключей и по каждому активному счётчику снято
            начальное показание — иначе расход не от чего отсчитывать. Чего не хватает,
            система скажет поимённо.
          </p>
          <button type="button" onClick={complete} disabled={pending} className="hp-btn-primary">
            <CheckCircle2 style={{ width: 16, height: 16 }} />
            Закрыть акт и запустить обслуживание
          </button>
        </div>
      )}
    </div>
  )
}
