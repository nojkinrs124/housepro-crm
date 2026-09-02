'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { findContactByPhoneAction, findLeadsByPhoneAction } from '../actions/duplicates.actions'

interface Match {
  id: string
  full_name: string | null
  href: string
  kind: 'Контакт' | 'Лид'
}

/**
 * Поле телефона, которое на выходе из фокуса проверяет, нет ли уже такой
 * карточки — среди контактов и среди лидов.
 *
 * Предупреждает, но не запрещает: муж и жена на одном номере, юрлицо и его
 * директор — законные совпадения. Задача — чтобы дубль не появился молча.
 */
export function PhoneDuplicateField({
  name = 'phone',
  defaultValue = '',
  className,
  placeholder = '+7 (999) 123-45-67',
  excludeId,
}: {
  name?: string
  defaultValue?: string
  className?: string
  placeholder?: string
  /** Своя же карточка при редактировании — её из совпадений убираем */
  excludeId?: string
}) {
  const [matches, setMatches] = useState<Match[]>([])
  const [, startCheck] = useTransition()

  return (
    <>
      <input
        type="tel"
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={className}
        onBlur={e => {
          const value = e.target.value
          if (!value.trim()) { setMatches([]); return }
          startCheck(async () => {
            const [contacts, leads] = await Promise.all([
              findContactByPhoneAction(value),
              findLeadsByPhoneAction(value),
            ])
            setMatches([
              ...contacts.matches.map(m => ({
                id: m.id, full_name: m.full_name, href: `/contacts/${m.id}`, kind: 'Контакт' as const,
              })),
              ...leads.matches.map(m => ({
                id: m.id, full_name: m.full_name, href: `/leads/${m.id}`, kind: 'Лид' as const,
              })),
            ].filter(m => m.id !== excludeId))
          })
        }}
      />
      {matches.length > 0 && (
        <p className="text-xs text-[var(--hp-warn)] mt-1">
          Такой телефон уже есть:{' '}
          {matches.slice(0, 3).map((m, i) => (
            <span key={`${m.kind}-${m.id}`}>
              {i > 0 && ', '}
              <Link href={m.href} target="_blank" className="underline">
                {m.kind.toLowerCase()} «{m.full_name || 'без имени'}»
              </Link>
            </span>
          ))}
          . Проверьте, не дубль ли это.
        </p>
      )}
    </>
  )
}
