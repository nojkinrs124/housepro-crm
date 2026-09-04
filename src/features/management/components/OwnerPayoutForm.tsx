'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ArrowUpRight } from 'lucide-react'
import { payOwnerAction } from '@/features/management/actions/settlement.actions'

const inp = 'hp-input'
const lbl = 'hp-label'

/**
 * Отметка выплаты собственнику.
 *
 * Один компонент на страницу взаиморасчёта и на карточку объекта: здесь
 * ошибка стоит живых денег, и двум копиям формы расходиться нельзя — ровно
 * так расходились словари статусов, пока у них не появился единый источник.
 */
export function OwnerPayoutForm({
  engagementId,
  balance,
  onDone,
}: {
  engagementId: string
  balance: number
  /** Закрыть форму после успеха — если она раскрывается по кнопке. */
  onDone?: () => void
}) {
  const [pending, start] = useTransition()
  const [advance, setAdvance] = useState(false)
  const today = new Date().toISOString().slice(0, 10)

  function submit(formData: FormData) {
    start(async () => {
      const res = await payOwnerAction(formData)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success('Выплата проведена')
      setAdvance(false)
      onDone?.()
    })
  }

  return (
    <form action={submit} className="space-y-3">
      <input type="hidden" name="engagement_id" value={engagementId} />
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <label className={lbl}>Сумма, ₽</label>
          <input name="amount" type="number" min="0" step="0.01" required
            defaultValue={balance > 0 ? balance : ''} className={inp} />
        </div>
        <div className="space-y-1.5">
          <label className={lbl}>Дата</label>
          <input name="date" type="date" max={today} defaultValue={today} className={inp} />
        </div>
        <div className="space-y-1.5">
          <label className={lbl}>Период с</label>
          <input name="period_start" type="date" className={inp} />
        </div>
        <div className="space-y-1.5">
          <label className={lbl}>по</label>
          <input name="period_end" type="date" className={inp} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-[var(--hp-ink)]">
        <input type="checkbox" name="as_advance" checked={advance}
          onChange={e => setAdvance(e.target.checked)} className="w-4 h-4 accent-[var(--hp-accent)]" />
        Это аванс — выплата больше текущего сальдо
      </label>
      <p className="text-xs text-[var(--hp-sub)]">
        Сальдо сейчас: {balance.toLocaleString('ru-RU')} ₽. Больше этой суммы без пометки
        «аванс» провести нельзя — иначе след денег теряется
      </p>
      <button type="submit" disabled={pending} className="hp-btn-primary">
        {pending ? 'Проводим…' : 'Провести выплату'}
      </button>
    </form>
  )
}

/**
 * Сальдо и отметка выплаты на карточке объекта.
 *
 * «Сколько я должен собственнику» — первый вопрос по объекту в управлении, а
 * отметка перевода — самое частое действие по нему. До 05.09.2026 и то и
 * другое жило за переходом на отдельную страницу, и на карточке не было даже
 * намёка, что взаиморасчёт вообще существует.
 */
export function OwnerPayoutBlock({
  engagementId,
  balance,
  ownerName,
}: {
  engagementId: string
  balance: number
  ownerName: string | null
}) {
  const [open, setOpen] = useState(false)
  const owed = balance > 0

  return (
    <div className="p-[18px] space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12.5px] text-[var(--hp-sub)]">
            {balance < 0 ? 'Долг собственника перед агентством' : 'К выплате собственнику'}
            {ownerName ? ` · ${ownerName}` : ''}
          </p>
          <p className={`text-[22px] font-semibold ${balance < 0 ? 'text-[var(--hp-danger)]' : 'text-[var(--hp-ink)]'}`}>
            {Math.abs(balance).toLocaleString('ru-RU')} ₽
          </p>
        </div>
        <button type="button" onClick={() => setOpen(!open)} className="hp-btn-primary shrink-0">
          <ArrowUpRight style={{ width: 16, height: 16 }} />
          {open ? 'Свернуть' : 'Я перевёл деньги собственнику'}
        </button>
      </div>

      {!open && !owed && (
        <p className="text-xs text-[var(--hp-sub)]">
          Сейчас к выплате ничего не начислено. Отметить перевод всё равно можно — он
          пройдёт как аванс.
        </p>
      )}

      {open && <OwnerPayoutForm engagementId={engagementId} balance={balance} onDone={() => setOpen(false)} />}
    </div>
  )
}
