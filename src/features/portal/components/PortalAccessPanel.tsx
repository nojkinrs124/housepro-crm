'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { KeyRound, Plus } from 'lucide-react'
import {
  grantPortalAccessAction,
  revokePortalAccessAction,
  issuePortalCodeAction,
} from '@/features/portal/actions/access.actions'

export interface AccessRow {
  id: string
  role: string
  contactName: string
  phoneMasked: string | null
  lastLoginAt: string | null
}

interface ContactOption { id: string; label: string; hasPhone: boolean }

/**
 * Доступы в личный кабинет по объекту.
 *
 * Здесь же выдаётся код входа: автоматической доставки сегодня нет ни по
 * одному каналу — contacts.telegram хранит @username, а по нему Telegram
 * личное сообщение не отправляет (нужен chat_id, которого в базе нет), SMS-
 * провайдер не подключён. Поэтому менеджер получает код один раз и передаёт
 * его тем каналом, которым уже общается с клиентом.
 */
export function PortalAccessPanel({
  propertyId,
  engagementId,
  accesses,
  owners,
  tenants,
}: {
  propertyId: string
  engagementId: string | null
  accesses: AccessRow[]
  owners: ContactOption[]
  tenants: ContactOption[]
}) {
  const [pending, start] = useTransition()
  const [adding, setAdding] = useState(false)
  const [role, setRole] = useState<'owner' | 'tenant'>('owner')
  const [issued, setIssued] = useState<{ id: string; code: string; minutes: number } | null>(null)

  const options = role === 'owner' ? owners : tenants

  function grant(formData: FormData) {
    start(async () => {
      const res = await grantPortalAccessAction(formData)
      if (res.error) toast.error(res.error)
      else {
        toast.success('Доступ выдан')
        setAdding(false)
      }
    })
  }

  function revoke(id: string, name: string) {
    if (!confirm(`Отозвать доступ у «${name}»? Кабинет закроется сразу.`)) return
    start(async () => {
      const res = await revokePortalAccessAction(id)
      if (res.error) toast.error(res.error)
      else toast.success('Доступ отозван')
    })
  }

  function issue(id: string) {
    start(async () => {
      const res = await issuePortalCodeAction(id)
      if (res.error) toast.error(res.error)
      else if (res.code) setIssued({ id, code: res.code, minutes: res.expiresInMinutes ?? 15 })
    })
  }

  return (
    <div className="hp-block">
      <div className="hp-block-header flex items-center justify-between gap-2">
        <span>Доступ в личный кабинет</span>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className="hp-btn-secondary">
            <Plus style={{ width: 14, height: 14 }} />
            Выдать
          </button>
        )}
      </div>

      {accesses.length === 0 && !adding && (
        <div className="p-[18px] text-sm text-[var(--hp-sub)]">
          Доступов нет. Собственник и арендатор смогут смотреть свои данные на сайте,
          когда вы выдадите им доступ.
        </div>
      )}

      {accesses.map(access => (
        <div key={access.id} className="hp-block-row">
          <span className="label">
            {access.contactName}
            <span className="block text-[12px]">
              {access.role === 'owner' ? 'собственник' : 'арендатор'}
              {access.phoneMasked && ` · ${access.phoneMasked}`}
            </span>
            {access.lastLoginAt && (
              <span className="block text-[12px]">
                заходил {access.lastLoginAt.slice(0, 10)}
              </span>
            )}
            {issued?.id === access.id && (
              <span className="block text-[13px] text-[var(--hp-accent)] mt-1">
                Код: <b>{issued.code}</b> — действует {issued.minutes} мин. Передайте его клиенту;
                повторно код не показать.
              </span>
            )}
          </span>
          <span className="value">
            <span className="flex flex-wrap gap-2 shrink-0 justify-end">
              <button type="button" onClick={() => issue(access.id)} disabled={pending} className="hp-btn-secondary">
                <KeyRound style={{ width: 14, height: 14 }} />
                Выдать код
              </button>
              <button type="button" onClick={() => revoke(access.id, access.contactName)} disabled={pending} className="hp-btn-secondary">
                Отозвать
              </button>
            </span>
          </span>
        </div>
      ))}

      {adding && (
        <form action={grant} className="p-[18px] space-y-3">
          <input type="hidden" name="property_id" value={propertyId} />
          {engagementId && <input type="hidden" name="engagement_id" value={engagementId} />}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="hp-label">Роль</label>
              <select name="role" value={role} onChange={e => setRole(e.target.value as 'owner' | 'tenant')} className="hp-input">
                <option value="owner">Собственник</option>
                <option value="tenant">Арендатор</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="hp-label">Контакт</label>
              <select name="contact_id" required className="hp-input">
                <option value="">Выберите</option>
                {options.map(o => (
                  <option key={o.id} value={o.id} disabled={!o.hasPhone}>
                    {o.label}{o.hasPhone ? '' : ' — нет телефона'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-xs text-[var(--hp-sub)]">
            Вход идёт по телефону из карточки контакта. Без телефона доступ не выдать.
          </p>

          <div className="flex flex-wrap gap-2 shrink-0">
            <button type="submit" disabled={pending} className="hp-btn-primary">Выдать доступ</button>
            <button type="button" onClick={() => setAdding(false)} className="hp-btn-secondary">Отмена</button>
          </div>
        </form>
      )}
    </div>
  )
}
