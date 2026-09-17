'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronDown, Loader2 } from 'lucide-react'
import { updateContractStatusAction } from '@/features/contracts/actions/contracts.actions'
import { confirmDialog } from '@/components/forms/ConfirmDialog'

const statuses = [
 { value: 'draft', label: 'Черновик', color: 'bg-[var(--hp-neutral-tint)] text-[var(--hp-sub)]' },
 { value: 'generated', label: 'Создан', color: 'bg-[var(--hp-info-tint)] text-[var(--hp-info)]' },
 { value: 'signed', label: 'Подписан', color: 'bg-[var(--hp-neutral-tint)] text-[var(--hp-sub)]' },
 { value: 'completed', label: 'Завершён', color: 'bg-[var(--hp-good-tint)] text-[var(--hp-good)]' },
 { value: 'cancelled', label: 'Отменён', color: 'bg-[var(--hp-danger-tint)] text-[var(--hp-danger)]' },
]

export function ContractStatusSelector({ contractId, currentStatus }: { contractId: string; currentStatus: string }) {
 const [open, setOpen] = useState(false)
 const [status, setStatus] = useState(currentStatus)
 const [isPending, startTransition] = useTransition()
 const router = useRouter()

 const current = statuses.find(s => s.value === status) ?? statuses[0]

 const handleSelect = async (value: string) => {
 setOpen(false)
 if (value === status) return
 // Откат подписанного договора в черновик стирает факт подписания — это
 // необратимо по смыслу и требует подтверждения (проход 17.09.2026, CT-2).
 const rank: Record<string, number> = { draft: 0, generated: 1, signed: 2, completed: 3 }
 if ((status === 'signed' || status === 'completed') && (rank[value] ?? 0) < rank[status]) {
 const ok = await confirmDialog(
 `Договор уже ${status === 'signed' ? 'подписан' : 'завершён'}. Вернуть его в «${statuses.find(s => s.value === value)?.label}»? Сделка по нему может откатиться на прежнюю стадию.`,
 { title: 'Откатить статус договора', confirmLabel: 'Вернуть', danger: true },
 )
 if (!ok) return
 }
 const prev = status
 setStatus(value)
 startTransition(async () => {
 const res = await updateContractStatusAction(contractId, value)
 if (res && 'error' in res && res.error) {
 setStatus(prev)
 toast.error(res.error)
 } else {
 router.refresh()
 }
 })
 }

 return (
 <div className="relative">
 <button
 onClick={() => setOpen(o => !o)}
 disabled={isPending}
 className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 font-medium transition hover:opacity-80 ${current.color} ${isPending ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
 >
 {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
 {current.label}
 <ChevronDown className="w-3.5 h-3.5" />
 </button>

 {open && !isPending && (
 <>
 <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
 <div className="absolute top-full left-0 mt-1 hp-card z-50 min-w-40 overflow-hidden">
 {statuses.map(s => (
 <button
 key={s.value}
 onClick={() => handleSelect(s.value)}
 className={`w-full px-4 py-2.5 text-left text-sm transition hover:bg-muted flex items-center gap-2 ${s.value === status ? 'font-semibold' : ''}`}
 >
 <span className={`w-2 h-2 rounded-full ${s.color.split(' ')[0]}`} />
 {s.label}
 </button>
 ))}
 </div>
 </>
 )}
 </div>
 )
}
