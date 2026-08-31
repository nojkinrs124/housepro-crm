'use client'

import { useActionState } from 'react'
import { createCategoryAction } from '../actions/categories.actions'
import type { AccountingTransactionType } from '@/types/database'
import { Plus } from 'lucide-react'
import { CHART_SERIES } from '@/lib/design/chartColors'

type State = { error?: string; success?: boolean } | null

// Палитра цвета статьи — общий ряд системы (см. src/lib/design/chartColors.ts).
// Раньше здесь был свой набор из десяти ярких хексов, часть из которых
// после сведения палитры схлопнулась в дубли.
const COLORS = [...CHART_SERIES]

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
 className="w-full h-9 px-3 border border-input bg-background text-sm outline-none focus:border-[var(--hp-ink)] transition-all"
 />
 </div>
 <div className="space-y-1">
 <label className="block text-xs font-semibold text-muted-foreground">Цвет</label>
 <select
 name="color"
 className="h-9 px-3 border border-input bg-background text-sm outline-none focus:border-[var(--hp-ink)] cursor-pointer"
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
 style={{ background: 'var(--hp-accent)' }}
 >
 <Plus className="w-3.5 h-3.5" />
 Добавить
 </button>
 {state && 'error' in state && state.error && <p className="w-full text-xs text-[var(--hp-danger)]">{state.error}</p>}
 </form>
 )
}
