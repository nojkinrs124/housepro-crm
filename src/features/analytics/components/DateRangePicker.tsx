'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { Calendar } from 'lucide-react'

interface Props {
 from?: string
 to?: string
}

const PRESETS = [
 { label: '7 дней', days: 7 },
 { label: '30 дней', days: 30 },
 { label: '90 дней', days: 90 },
 { label: 'Год', days: 365 },
]

export function DateRangePicker({ from, to }: Props) {
 const router = useRouter()
 const params = useSearchParams()

 const push = useCallback((f: string, t: string) => {
 const sp = new URLSearchParams(params.toString())
 sp.set('from', f)
 sp.set('to', t)
 router.push(`/analytics?${sp.toString()}`)
 }, [router, params])

 function applyPreset(days: number) {
 const t = new Date()
 const f = new Date(t)
 f.setDate(f.getDate() - days)
 push(f.toISOString().slice(0, 10), t.toISOString().slice(0, 10))
 }

 return (
 <div className="flex flex-wrap items-center gap-2">
 {PRESETS.map(p => (
 <button
 key={p.days}
 onClick={() => applyPreset(p.days)}
 className="px-3 py-1.5 text-xs font-medium border border-[var(--hp-border)] bg-[var(--hp-surface)] text-[var(--hp-sub)] hover:bg-[var(--hp-neutral-tint)] hover:border-primary/40 transition-colors"
 >
 {p.label}
 </button>
 ))}

 <div className="flex items-center gap-1.5 ml-2">
 <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
 <input
 type="date"
 defaultValue={from}
 onChange={e => push(e.target.value, to ?? new Date().toISOString().slice(0, 10))}
 className="text-xs px-2 py-1.5 border border-[var(--hp-border)] bg-[var(--hp-surface)] outline-none focus:border-[var(--hp-ink)]"
 />
 <span className="text-muted-foreground text-xs">—</span>
 <input
 type="date"
 defaultValue={to}
 onChange={e => push(from ?? '', e.target.value)}
 className="text-xs px-2 py-1.5 border border-[var(--hp-border)] bg-[var(--hp-surface)] outline-none focus:border-[var(--hp-ink)]"
 />
 </div>
 </div>
 )
}
