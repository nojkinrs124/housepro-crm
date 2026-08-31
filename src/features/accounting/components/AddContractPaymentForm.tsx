'use client'

import { useState, useActionState } from 'react'
import { Plus, X, Loader2, AlertCircle } from 'lucide-react'
import { createContractPaymentAction } from '../actions/accounting.actions'

type ActionState = { error?: string; success?: boolean } | null

async function createBound(contractId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
 return createContractPaymentAction(contractId, _prev, formData)
}

export function AddContractPaymentForm({ contractId }: { contractId: string }) {
 const [open, setOpen] = useState(false)
 const boundAction = createBound.bind(null, contractId)
 const [state, formAction, isPending] = useActionState(boundAction, null)

 if (state?.success && open) {
 setOpen(false)
 }

 if (!open) {
 return (
 <button
 onClick={() => setOpen(true)}
 className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
 >
 <Plus className="w-3.5 h-3.5" />
 Добавить
 </button>
 )
 }

 return (
 <div className="border border-border p-4 bg-muted/20 space-y-3">
 <div className="flex items-center justify-between">
 <p className="text-sm font-medium text-foreground">Новый платёж</p>
 <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
 <X className="w-4 h-4" />
 </button>
 </div>

 <form action={formAction} className="space-y-3">
 <div className="grid grid-cols-2 gap-3">
 <div className="space-y-1">
 <label className="text-xs text-muted-foreground">Сумма, ₽ *</label>
 <input
 name="amount" type="number" min="1" step="0.01" required placeholder="50 000"
 className="w-full h-10 px-4 border border-input bg-background text-sm outline-none focus:border-[var(--hp-ink)] transition-all"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs text-muted-foreground">Срок оплаты</label>
 <input
 name="due_date" type="date"
 className="w-full h-10 px-4 border border-input bg-background text-sm outline-none focus:border-[var(--hp-ink)] transition-all"
 />
 </div>
 </div>

 <div className="space-y-1">
 <label className="text-xs text-muted-foreground">Примечание</label>
 <input
 name="description" type="text" placeholder="Аренда за март..."
 className="w-full h-10 px-4 border border-input bg-background text-sm outline-none focus:border-[var(--hp-ink)] transition-all"
 />
 </div>

 <div className="flex items-center justify-between pt-1">
 {state?.error && (
 <div className="flex items-center gap-1.5 text-xs text-destructive">
 <AlertCircle className="w-3.5 h-3.5" />
 {state.error}
 </div>
 )}
 <button
 type="submit" disabled={isPending}
 className="ml-auto flex items-center gap-2 px-4 py-2 text-white text-sm font-bold disabled:opacity-60 disabled:hover:translate-y-0 transition-all"
 style={{ background: 'var(--hp-accent)', }}
 >
 {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
 Добавить
 </button>
 </div>
 </form>
 </div>
 )
}
