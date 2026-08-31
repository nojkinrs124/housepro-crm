'use client'

import { useState } from 'react'
import { updateLeadStatusAction } from '@/features/leads/actions/leads.actions'

const statuses = [
 { value: 'new', label: 'Новый', color: 'border-[var(--hp-border)] bg-[var(--hp-info-tint)] text-[var(--hp-info)]' },
 { value: 'contacted', label: 'Связались', color: 'border-[var(--hp-border)] bg-[var(--hp-warn-tint)] text-[var(--hp-warn)]' },
 { value: 'showing', label: 'Показ', color: 'border-[var(--hp-border)] bg-[var(--hp-warn-tint)] text-[var(--hp-warn)]' },
 { value: 'searching', label: 'Подбор', color: 'border-[var(--hp-border)] bg-[var(--hp-neutral-tint)] text-[var(--hp-sub)]' },
 { value: 'interested', label: 'Заинтересован', color: 'border-[var(--hp-border)] bg-[var(--hp-info-tint)] text-[var(--hp-info)]' },
 { value: 'converted', label: 'Конвертирован', color: 'border-[var(--hp-border)] bg-[var(--hp-good-tint)] text-[var(--hp-good)]' },
 { value: 'closed', label: 'Закрыт', color: 'border-[var(--hp-border)] bg-[var(--hp-neutral-tint)] text-[var(--hp-sub)]' },
 { value: 'rejected', label: 'Отказ', color: 'border-[var(--hp-border)] bg-[var(--hp-danger-tint)] text-[var(--hp-danger)]' },
]

export function LeadStatusSelect({ leadId, currentStatus }: { leadId: string; currentStatus: string }) {
 const [status, setStatus] = useState(currentStatus)
 const [loading, setLoading] = useState(false)

 const current = statuses.find(s => s.value === status) ?? statuses[0]

 async function handleChange(newStatus: string) {
 if (newStatus === status) return
 setLoading(true)
 setStatus(newStatus)
 await updateLeadStatusAction(leadId, newStatus)
 setLoading(false)
 }

 return (
 <div className="space-y-2">
 <div className={`px-3 py-2 border text-sm font-medium text-center ${current.color} ${loading ? 'opacity-60' : ''}`}>
 {loading ? 'Сохранение...' : current.label}
 </div>
 <div className="grid grid-cols-2 gap-1.5">
 {statuses.map(s => (
 <button
 key={s.value}
 onClick={() => handleChange(s.value)}
 disabled={loading}
 className={`px-2 py-1.5 text-xs font-medium border transition-all leading-tight break-words ${
 s.value === status
 ? `${s.color} ring-1 ring-current`
 : 'border-border text-muted-foreground hover:border-primary/40 hover:bg-accent'
 }`}
 >
 {s.label}
 </button>
 ))}
 </div>
 </div>
 )
}
