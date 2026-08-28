import { createClient } from '@/lib/supabase/server'
import { Users, Plus, UserCheck, Crown, UserX } from 'lucide-react'
import Link from 'next/link'
import type { Contact } from '@/types/database'
import { ContactsViewSwitcher } from '@/features/contacts/components/ContactsViewSwitcher'
import { PageHeader } from '@/components/layout/PageHeader'
import { buttonVariants } from '@/components/ui/button'

export default async function ContactsPage() {
  const supabase = await createClient()
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, full_name, phone, email, role, status, source, created_at')
    .order('created_at', { ascending: false })

  const total    = contacts?.length ?? 0
  const clients  = (contacts ?? []).filter(c => c.role === 'client' || c.role === 'both').length
  const owners   = (contacts ?? []).filter(c => c.role === 'owner' || c.role === 'both').length
  const vip      = (contacts ?? []).filter(c => c.status === 'vip').length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Контакты"
        subtitle={`${total} контактов в базе`}
        actions={
          <Link href="/contacts/new" className={buttonVariants({ size: 'lg' })}>
            <Plus style={{ width: 16, height: 16 }} />
            Добавить контакт
          </Link>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Всего',         value: total,   Icon: Users },
          { label: 'Клиентов',      value: clients, Icon: UserCheck },
          { label: 'Собственников', value: owners,  Icon: Users },
          { label: 'VIP',           value: vip,     Icon: Crown },
        ].map(stat => {
          const Icon = stat.Icon
          return (
            <div key={stat.label} className="hp-stat-card">
              <div className="w-11 h-11 rounded-[var(--hp-radius)] flex items-center justify-center shrink-0 bg-[var(--hp-neutral-tint)] border border-[var(--hp-border)]">
                <Icon style={{ width: 20, height: 20, color: 'var(--hp-sub)' }} />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-[var(--hp-ink)]">{stat.value}</p>
                <p className="text-xs text-[var(--hp-sub)] font-medium mt-0.5 leading-tight break-words">{stat.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      {total === 0 ? (
        <div className="hp-card hp-empty">
          <div className="w-16 h-16 rounded-[var(--hp-radius)] flex items-center justify-center mx-auto mb-4 bg-[var(--hp-neutral-tint)] border border-[var(--hp-border)]">
            <Users style={{ width: 28, height: 28, color: 'var(--hp-sub)' }} />
          </div>
          <p className="text-[var(--hp-ink)] font-bold text-lg">Контактов ещё нет</p>
          <p className="text-[var(--hp-sub)] text-sm mt-1">Добавьте первый контакт в базу</p>
          <Link href="/contacts/new" className="hp-btn-primary mt-5">
            <Plus style={{ width: 16, height: 16 }} />
            Добавить контакт
          </Link>
        </div>
      ) : (
        <ContactsViewSwitcher contacts={contacts as Contact[]} />
      )}
    </div>
  )
}
