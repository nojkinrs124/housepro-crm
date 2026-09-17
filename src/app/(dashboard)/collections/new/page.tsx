import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createCollectionAction } from '@/features/collections/actions/collections.actions'
import { ServerActionForm } from '@/components/forms/ServerActionForm'
import { contactDisplayName } from '@/features/contacts/config/display-name'

export default async function NewCollectionPage({
 searchParams,
}: {
 searchParams: Promise<{ deal_id?: string; lead_id?: string }>
}) {
 const params = await searchParams
 const supabase = await createClient()
 const { data: { user } } = await supabase.auth.getUser()
 if (!user) redirect('/login')

 // Подборка живёт при сделке подбора (лид — для обращений, которых ещё не
 // перевели в сделку). Сделки закрытые и отменённые не предлагаем.
 const [{ data: leads }, { data: deals }] = await Promise.all([
 supabase
 .from('leads')
 .select('id, full_name')
 .in('status', ['new','contacted','showing','searching'])
 .order('created_at', { ascending: false })
 .limit(100),
 supabase
 .from('deals')
 .select('id, deal_number, client_contact:contacts!deals_client_contact_id_fkey(full_name, company_name, client_type)')
 .eq('deal_type', 'tenant_search')
 .not('status', 'in', '(completed,cancelled)')
 .order('created_at', { ascending: false })
 .limit(100),
 ])
 const dealOptions = (deals ?? []).map(d => ({
 id: d.id,
 label: `СД-${d.deal_number ?? '?'} · ${contactDisplayName(d.client_contact as { full_name: string | null; company_name: string | null; client_type: string | null } | null, 'без клиента')}`,
 }))
 const preselectedDeal = dealOptions.find(d => d.id === params.deal_id)

 return (
 <div className="max-w-lg mx-auto space-y-6">
 <div className="flex items-center gap-3">
 <Link href="/collections" className="p-2 hover:bg-[var(--hp-neutral-tint)] transition-colors text-muted-foreground">
 <ArrowLeft className="w-4 h-4" />
 </Link>
 <h1 className="text-xl font-bold">Новая подборка</h1>
 </div>

 <ServerActionForm action={createCollectionAction} className="hp-card p-6 space-y-5">
 <div>
 <label className="block text-sm font-medium text-foreground mb-1.5">
 Название <span className="text-[var(--hp-danger)]">*</span>
 </label>
 <input
 type="text"
 name="title"
 required
 placeholder="Например: 3-комнатные на Арбате для Ивановых"
 className="w-full px-3 py-2 text-sm border border-[var(--hp-border)] outline-none focus:border-[var(--hp-ink)]"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-foreground mb-1.5">Сделка подбора</label>
 <select
 name="deal_id"
 defaultValue={preselectedDeal?.id ?? ''}
 className="w-full px-3 py-2 text-sm border border-[var(--hp-border)] bg-[var(--hp-surface)] outline-none focus:border-[var(--hp-ink)]"
 >
 <option value="">— без сделки —</option>
 {dealOptions.map(d => (
 <option key={d.id} value={d.id}>{d.label}</option>
 ))}
 </select>
 <p className="text-xs text-[var(--hp-sub)] mt-1">Подборка при сделке закрывает стадию «Подборка отправлена», когда её отправят клиенту</p>
 </div>

 <div>
 <label className="block text-sm font-medium text-foreground mb-1.5">Привязать к лиду</label>
 <select
 name="lead_id"
 defaultValue={params.lead_id ?? ''}
 className="w-full px-3 py-2 text-sm border border-[var(--hp-border)] bg-[var(--hp-surface)] outline-none focus:border-[var(--hp-ink)]"
 >
 <option value="">— Выбрать лида (необязательно) —</option>
 {leads?.map(l => (
 <option key={l.id} value={l.id}>{l.full_name}</option>
 ))}
 </select>
 </div>

 <div className="flex gap-3 pt-1">
 <button
 type="submit"
 className="flex-1 py-2.5 bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
 >
 Создать подборку
 </button>
 <Link
 href="/collections"
 className="px-5 py-2.5 border border-[var(--hp-border)] text-foreground text-sm font-medium hover:bg-[var(--hp-neutral-tint)] transition-colors"
 >
 Отмена
 </Link>
 </div>
 </ServerActionForm>
 </div>
 )
}
