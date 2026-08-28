'use client'

import { useState } from 'react'
import { updateLeadStatusAction } from '@/features/leads/actions/leads.actions'

const statuses = [
 { value: 'new', label: 'Новый', color: 'border-blue-300 bg-blue-50 text-blue-700' },
 { value: 'contacted', label: 'Связались', color: 'border-yellow-300 bg-yellow-50 text-yellow-700' },
 { value: 'showing', label: 'Показ', color: 'border-orange-300 bg-orange-50 text-orange-700' },
 { value: 'searching', label: 'Подбор', color: 'border-purple-300 bg-purple-50 text-purple-700' },
 { value: 'interested', label: 'Заинтересован', color: 'border-cyan-300 bg-cyan-50 text-cyan-700' },
 { value: 'converted', label: 'Конвертирован', color: 'border-green-300 bg-green-50 text-green-700' },
 { value: 'closed', label: 'Закрыт', color: 'border-gray-300 bg-gray-50 text-gray-600' },
 { value: 'rejected', label: 'Отказ', color: 'border-red-300 bg-red-50 text-red-600' },
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
