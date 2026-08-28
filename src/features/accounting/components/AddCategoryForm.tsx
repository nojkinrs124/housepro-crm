'use client'

import { useActionState } from 'react'
import { createCategoryAction } from '../actions/categories.actions'
import type { AccountingTransactionType } from '@/types/database'
import { Plus } from 'lucide-react'

type State = { error?: string; success?: boolean } | null

const COLORS = [
 '#16A34A', '#22C55E', '#4ADE80', '#EF4444', '#F97316',
 '#8B5CF6', '#06B6D4', '#F59E0B', '#DB2777', '#64748B',
]

export function AddCategoryForm({ defaultType }: { defaultType?: AccountingTransactionType }) {
 const [state, formAction, isPending] = useActionState(createCategoryAction, null)

 return (
 <form action={formAction} className="flex items-end gap-2 flex-wrap">
 <input type="hidden" name="type" value={defaultType ?? 'income'} />
 <div className="space-y-1 flex-1 min-w-[140px]">
 <label className="block text-xs font-semibold text-muted-foreground">Название</label>
 <input
 type="text"
 name="name"
 placeholder="Новая категория"
 className="w-full h-9 px-3 border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
 />
 </div>
 <div className="space-y-1">
 <label className="block text-xs font-semibold text-muted-foreground">Цвет</label>
 <select
 name="color"
 className="h-9 px-3 border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
 >
 {COLORS.map(c => (
 <option key={c} value={c} style={{ background: c, color: '#fff' }}>{c}</option>
 ))}
 </select>
 </div>
 <button
 type="submit"
 disabled={isPending}
 className="h-9 flex items-center gap-1.5 px-3 text-white text-xs font-bold disabled:opacity-60"
 style={{ background: 'var(--hp-gradient-primary)' }}
 >
 <Plus className="w-3.5 h-3.5" />
 Добавить
 </button>
 {state && 'error' in state && state.error && <p className="w-full text-xs text-red-500">{state.error}</p>}
 </form>
 )
}
