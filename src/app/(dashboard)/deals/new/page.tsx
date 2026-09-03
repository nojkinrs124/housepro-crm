import { createDealAction } from '@/features/deals/actions/deals.actions'
import { createClient } from '@/lib/supabase/server'
import { TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { ServerActionForm } from '@/components/forms/ServerActionForm'
import { DealFormBody } from '@/features/deals/components/DealFormBody'
import { PageHeader } from '@/components/layout/PageHeader'
import type { RepresentativeOption } from '@/features/deals/components/DealFormBody'

export default async function NewDealPage({
  searchParams,
}: {
  // contact_id — универсальный параметр (роль определяется автоматически по contacts.role).
  // client_id оставлен для обратной совместимости со старыми ссылками.
  searchParams: Promise<{ contact_id?: string; client_id?: string; property_id?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  // Загружаем контакты — единая база (owners + clients)
  const [{ data: rawContacts }, { data: rawProperties }, { data: rawReps }] = await Promise.all([
    supabase.from('contacts').select('id, full_name, phone, role, client_type').order('full_name'),
    supabase.from('properties').select('id, title, address').order('title'),
    supabase.from('contact_representatives').select('id, contact_id, full_name, position, is_primary').order('is_primary', { ascending: false }),
  ])

  const contacts = rawContacts ?? []
  const properties = rawProperties ?? []

  // Фильтруем по ролям
  const owners  = contacts.filter(c => c.role === 'owner'  || c.role === 'both')
  const clients = contacts.filter(c => c.role === 'client' || c.role === 'both')

  const representativesByContact: Record<string, RepresentativeOption[]> = {}
  for (const r of rawReps ?? []) {
    (representativesByContact[r.contact_id] ??= []).push(r)
  }

  // Авто-подстановка стороны по роли контакта, из которого создаётся сделка.
  const sourceContactId = params.contact_id ?? params.client_id
  const sourceContact = sourceContactId ? contacts.find(c => c.id === sourceContactId) : undefined

  // При role === 'both' однозначно определить сторону нельзя — по умолчанию считаем клиентом
  // (это самый частый случай перехода «создать сделку» с карточки контакта).
  const ownerDefaultId = sourceContact?.role === 'owner' ? sourceContact.id : ''
  const clientDefaultId = sourceContact?.role === 'client' || sourceContact?.role === 'both'
    ? sourceContact.id
    : (!sourceContact && params.client_id ? params.client_id : '')

  const primaryRepFor = (contactId: string) =>
    (representativesByContact[contactId] ?? []).find(r => r.is_primary)?.id ?? ''

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <PageHeader
        crumbs={[{ label: 'Сделки', href: '/deals' }, { label: 'Новая сделка' }]}
        title="Новая сделка"
        subtitle="Укажите обе стороны и объект"
        backHref="/deals"
        backLabel="Назад к сделкам"
        icon={<TrendingUp className="w-5 h-5" style={{ color: 'var(--hp-ink)' }} />}
      />

      <ServerActionForm action={createDealAction} className="space-y-4">
        <DealFormBody
          owners={owners}
          clients={clients}
          properties={properties}
          representativesByContact={representativesByContact}
          ownerDefaultId={ownerDefaultId}
          clientDefaultId={clientDefaultId}
          ownerRepDefaultId={ownerDefaultId ? primaryRepFor(ownerDefaultId) : ''}
          clientRepDefaultId={clientDefaultId ? primaryRepFor(clientDefaultId) : ''}
          propertyDefaultId={params.property_id ?? ''}
        />

        <div className="flex items-center gap-3 pt-1">
          <button type="submit" className="hp-btn-primary">
            <TrendingUp className="w-4 h-4" />
            Создать сделку
          </button>
          <Link href="/deals" className="hp-btn-secondary">Отмена</Link>
        </div>
      </ServerActionForm>
    </div>
  )
}
