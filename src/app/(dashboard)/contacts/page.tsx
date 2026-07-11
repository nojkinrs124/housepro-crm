import { createClient } from '@/lib/supabase/server'
import { Users, Plus, UserCheck, Crown, UserX } from 'lucide-react'
import Link from 'next/link'
import type { Contact } from '@/types/database'
import { ContactsViewSwitcher } from '@/features/contacts/components/ContactsViewSwitcher'

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
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-foreground tracking-tight">Контакты</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">{total} контактов в базе</p>
        </div>
        <Link href="/contacts/new"
          className="flex items-center gap-2 px-5 py-2.5 text-white rounded-[14px] text-sm font-bold transition-all hover:-translate-y-0.5"
          style={{ background: 'var(--hp-gradient-primary)', boxShadow: '0 4px 16px rgba(22,163,74,0.35)' }}>
          <Plus style={{ width: 16, height: 16 }} />
          Добавить контакт
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Всего',         value: total,   Icon: Users,     iconCls: 'bg-blue-50',   iconColor: 'text-blue-500' },
          { label: 'Клиентов',      value: clients, Icon: UserCheck, iconCls: 'bg-green-50',  iconColor: 'text-green-600' },
          { label: 'Собственников', value: owners,  Icon: Users,     iconCls: 'bg-violet-50', iconColor: 'text-violet-600' },
          { label: 'VIP',           value: vip,     Icon: Crown,     iconCls: 'bg-amber-50',  iconColor: 'text-amber-500' },
        ].map(stat => {
          const Icon = stat.Icon
          return (
            <div key={stat.label} className="bg-white rounded-[20px] border border-slate-200/60 shadow-sm p-5 flex items-center gap-3 sm:gap-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${stat.iconCls}`}>
                <Icon className={stat.iconColor} style={{ width: 20, height: 20 }} />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground font-medium mt-0.5 leading-tight break-words">{stat.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      {total === 0 ? (
        <div className="bg-white rounded-[20px] border border-slate-100 p-16 text-center" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}>
          <div className="w-16 h-16 rounded-[20px] flex items-center justify-center mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg, rgba(22,163,74,0.1), rgba(34,197,94,0.1))' }}>
            <Users style={{ width: 28, height: 28, color: '#16A34A' }} />
          </div>
          <p className="text-foreground font-bold text-lg">Контактов ещё нет</p>
          <p className="text-muted-foreground text-sm mt-1">Добавьте первый контакт в базу</p>
          <Link href="/contacts/new"
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 text-white rounded-[14px] text-sm font-bold hover:-translate-y-0.5 transition-all"
            style={{ background: 'var(--hp-gradient-primary)', boxShadow: '0 4px 16px rgba(22,163,74,0.35)' }}>
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
