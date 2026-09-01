import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CopyCheck } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { findDuplicateContactsAction } from '@/features/contacts/actions/duplicates.actions'
import { DuplicateGroupCard } from '@/features/contacts/components/DuplicateGroupCard'

export const dynamic = 'force-dynamic'

export default async function ContactDuplicatesPage() {
 const supabase = await createClient()
 const { data: { user } } = await supabase.auth.getUser()
 if (!user) redirect('/login')

 const { groups, error } = await findDuplicateContactsAction()
 const affected = (groups ?? []).reduce((sum, g) => sum + g.contacts.length, 0)

 return (
 <div className="max-w-3xl mx-auto space-y-6">
 <PageHeader
 title="Дубли контактов"
 subtitle={
 groups?.length
 ? `${groups.length} групп, ${affected} карточек`
 : 'Совпадения по телефону и почте'
 }
 backHref="/contacts"
 backLabel="Все контакты"
 iconBg="bg-[var(--hp-neutral-tint)]"
 icon={<CopyCheck className="text-[var(--hp-ink)]" style={{ width: 20, height: 20 }} />}
 />

 {error && (
 <div className="hp-card p-5">
 <p className="text-sm text-[var(--hp-danger)]">{error}</p>
 </div>
 )}

 {!error && (!groups || groups.length === 0) ? (
 <div className="hp-card hp-empty text-center py-16">
 <div className="w-14 h-14 flex items-center justify-center mx-auto mb-4 bg-[var(--hp-neutral-tint)] border border-[var(--hp-border)]">
 <CopyCheck style={{ width: 24, height: 24, color: 'var(--hp-sub)' }} />
 </div>
 <p className="text-[var(--hp-ink)] font-bold text-base">Дублей не найдено</p>
 <p className="text-[var(--hp-sub)] text-sm mt-1">
 Контакты с одинаковым телефоном или почтой появятся здесь автоматически
 </p>
 </div>
 ) : (
 (groups ?? []).map((group) => (
 <DuplicateGroupCard key={`${group.reason}-${group.key}`} group={group} />
 ))
 )}
 </div>
 )
}
