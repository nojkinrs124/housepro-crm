import { createClient } from '@/lib/supabase/server'
import { Users, Plus } from 'lucide-react'
import Link from 'next/link'
import type { Contact } from '@/types/database'
import { ContactCard } from './ContactCard'

export default async function ContactsPage() {
  const supabase = await createClient()
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, full_name, phone, email, role, status, source, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-[#111827] tracking-tight">Контакты</h1>
          <p className="text-[#64748B] mt-1 text-sm font-medium">{contacts?.length ?? 0} контактов в базе</p>
        </div>
        <Link href="/contacts/new"
          className="flex items-center gap-2 px-5 py-2.5 text-white rounded-[14px] text-sm font-bold transition-all hover:-translate-y-0.5"
          style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)', boxShadow: '0 4px 16px rgba(22,163,74,0.35)' }}>
          <Plus style={{ width: 16, height: 16 }} />
          Добавить контакт
        </Link>
      </div>

      {contacts && contacts.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {(contacts as Contact[]).map((contact, idx) => (
            <ContactCard key={contact.id} contact={contact} idx={idx} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-[20px] border border-slate-100 p-16 text-center" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}>
          <div className="w-16 h-16 rounded-[20px] flex items-center justify-center mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg, rgba(22,163,74,0.1), rgba(34,197,94,0.1))' }}>
            <Users style={{ width: 28, height: 28, color: '#16A34A' }} />
          </div>
          <p className="text-[#111827] font-bold text-lg">Контактов ещё нет</p>
          <p className="text-[#64748B] text-sm mt-1">Добавьте первый контакт в базу</p>
          <Link href="/contacts/new"
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 text-white rounded-[14px] text-sm font-bold hover:-translate-y-0.5 transition-all"
            style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)', boxShadow: '0 4px 16px rgba(22,163,74,0.35)' }}>
            <Plus style={{ width: 16, height: 16 }} />
            Добавить контакт
          </Link>
        </div>
      )}
    </div>
  )
}
