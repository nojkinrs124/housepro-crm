'use client'

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { updateShowingStatusAction } from '../actions/showings.actions'

const RESULTS = [
 { value: 'interested', label: 'Заинтересован' },
 { value: 'thinking', label: 'Думает' },
 { value: 'not_interested', label: 'Не заинтересован' },
]

export function ShowingResultForm({ showingId }: { showingId: string }) {
 const [loading, setLoading] = useState(false)
 const [done, setDone] = useState(false)

 async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
 e.preventDefault()
 setLoading(true)
 const fd = new FormData(e.currentTarget)
 const res = await updateShowingStatusAction(showingId, 'completed', fd)
 setLoading(false)
 if (res && 'error' in res) alert(res.error)
 else setDone(true)
 }

 if (done) {
 return (
 <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
 <CheckCircle2 className="w-4 h-4" /> Результат сохранён
 </div>
 )
 }

 return (
 <form onSubmit={handleSubmit} className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-foreground mb-1.5">Результат</label>
 <div className="flex gap-2 flex-wrap">
 {RESULTS.map(r => (
 <label key={r.value} className="flex items-center gap-2 cursor-pointer">
 <input type="radio" name="result" value={r.value} className="accent-primary" />
 <span className="text-sm">{r.label}</span>
 </label>
 ))}
 </div>
 </div>

 <div>
 <label className="block text-sm font-medium text-foreground mb-1.5">Обратная связь</label>
 <textarea
 name="feedback"
 rows={3}
 placeholder="Что понравилось / не понравилось клиенту…"
 className="w-full px-3 py-2 text-sm border border-[var(--hp-border)] resize-none outline-none focus:border-[var(--hp-ink)]"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-foreground mb-1.5">Следующий шаг</label>
 <input
 type="text"
 name="next_step"
 placeholder="Повторный показ, согласование условий…"
 className="w-full px-3 py-2 text-sm border border-[var(--hp-border)] outline-none focus:border-[var(--hp-ink)]"
 />
 </div>

 <button
 type="submit"
 disabled={loading}
 className="px-5 py-2 bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
 >
 {loading ? 'Сохраняю…' : 'Завершить показ'}
 </button>
 </form>
 )
}
