'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { updateLeadStatusAction } from '@/features/leads/actions/leads.actions'
import { LEAD_STATUSES } from '@/features/leads/config/lead-statuses'

const statuses = LEAD_STATUSES.map(s => ({
 value: s.value,
 label: s.label,
 color: `border-[var(--hp-border)] ${s.badge}`,
}))

export function LeadStatusSelect({ leadId, currentStatus }: { leadId: string; currentStatus: string }) {
 const [status, setStatus] = useState(currentStatus)
 const [loading, setLoading] = useState(false)

 const current = statuses.find(s => s.value === status) ?? statuses[0]

 async function handleChange(newStatus: string) {
 if (newStatus === status) return
 const previous = status
 setLoading(true)
 setStatus(newStatus)

 const res = await updateLeadStatusAction(leadId, newStatus)

 // Откат: без него отказ сервера был не виден вообще — плашка показывала новый
 // статус до перезагрузки страницы, а в базе оставался старый (так молча
 // терялись «Заинтересован» и «Отказ», запрещённые CHECK-ограничением).
 if (res?.error) {
 setStatus(previous)
 toast.error(res.error)
 }

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
