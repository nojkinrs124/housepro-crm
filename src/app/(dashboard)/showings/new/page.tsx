import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createShowingAction } from '@/features/showings/actions/showings.actions'
import { ServerActionForm } from '@/components/forms/ServerActionForm'
import { PropertySelectField } from '@/features/properties/components/PropertySelectField'

export default async function NewShowingPage() {
 const supabase = await createClient()
 const { data: { user } } = await supabase.auth.getUser()
 if (!user) redirect('/login')

 const [{ data: properties }, { data: leads }, { data: agents }] = await Promise.all([
 supabase.from('properties').select('id, title, address').order('created_at', { ascending: false }).limit(100),
 supabase.from('leads').select('id, full_name').in('status', ['new','contacted','showing','searching']).order('created_at', { ascending: false }).limit(100),
 supabase.from('users').select('id, full_name').eq('is_active', true).order('full_name'),
 ])

 return (
 <div className="max-w-2xl mx-auto space-y-6">
 <div className="flex items-center gap-3">
 <Link href="/showings" className="p-2 hover:bg-[var(--hp-neutral-tint)] transition-colors text-muted-foreground">
 <ArrowLeft className="w-4 h-4" />
 </Link>
 <div>
 <h1 className="text-xl font-bold">Новый показ</h1>
 <p className="text-sm text-muted-foreground">Запланируйте показ объекта</p>
 </div>
 </div>

 <ServerActionForm action={createShowingAction} className="hp-card p-6 space-y-5">
 {/* Property */}
 <PropertySelectField properties={properties ?? []} />

 {/* Lead */}
 <div>
 <label className="block text-sm font-medium text-foreground mb-1.5">Лид (клиент)</label>
 <select
 name="lead_id"
 className="w-full px-3 py-2 text-sm border border-[var(--hp-border)] bg-[var(--hp-surface)] outline-none focus:border-[var(--hp-ink)]"
 >
 <option value="">— Выбрать лида —</option>
 {leads?.map(l => (
 <option key={l.id} value={l.id}>{l.full_name}</option>
 ))}
 </select>
 </div>

 {/* Date/time */}
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-foreground mb-1.5">
 Дата и время <span className="text-[var(--hp-danger)]">*</span>
 </label>
 <input
 type="datetime-local"
 name="scheduled_at"
 required
 className="w-full px-3 py-2 text-sm border border-[var(--hp-border)] outline-none focus:border-[var(--hp-ink)]"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-foreground mb-1.5">Длительность (мин)</label>
 <select
 name="duration_min"
 className="w-full px-3 py-2 text-sm border border-[var(--hp-border)] bg-[var(--hp-surface)] outline-none focus:border-[var(--hp-ink)]"
 >
 <option value="15">15 мин</option>
 <option value="30" selected>30 мин</option>
 <option value="45">45 мин</option>
 <option value="60">1 час</option>
 <option value="90">1.5 часа</option>
 <option value="120">2 часа</option>
 </select>
 </div>
 </div>

 {/* Agent */}
 <div>
 <label className="block text-sm font-medium text-foreground mb-1.5">Агент</label>
 <select
 name="agent_id"
 className="w-full px-3 py-2 text-sm border border-[var(--hp-border)] bg-[var(--hp-surface)] outline-none focus:border-[var(--hp-ink)]"
 >
 {agents?.map(a => (
 <option key={a.id} value={a.id}>{a.full_name}</option>
 ))}
 </select>
 </div>

 {/* Notes */}
 <div>
 <label className="block text-sm font-medium text-foreground mb-1.5">Заметки</label>
 <textarea
 name="feedback"
 rows={3}
 placeholder="Пожелания, особенности показа…"
 className="w-full px-3 py-2 text-sm border border-[var(--hp-border)] resize-none outline-none focus:border-[var(--hp-ink)]"
 />
 </div>

 <div className="flex gap-3 pt-1">
 <button
 type="submit"
 className="flex-1 py-2.5 bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
 >
 Запланировать показ
 </button>
 <Link
 href="/showings"
 className="px-5 py-2.5 border border-[var(--hp-border)] text-foreground text-sm font-medium hover:bg-[var(--hp-neutral-tint)] transition-colors"
 >
 Отмена
 </Link>
 </div>
 </ServerActionForm>
 </div>
 )
}
