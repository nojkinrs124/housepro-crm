import { createClient } from '@/lib/supabase/server'
import { DeleteContractButton } from '@/features/contracts/components/DeleteContractButton'
import { ArrowLeft, FileText, User, Home, Building2, Calendar, DollarSign, Edit } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PaymentsSection } from '@/features/payments/components/PaymentsSection'

const contractTypeLabels: Record<string, string> = {
  rent_apartment: 'Аренда квартиры',
  rent_commercial: 'Коммерческая аренда',
  sale_apartment: 'Продажа квартиры',
  sale_house: 'Продажа дома',
  property_management: 'Управление недвижимостью',
  sublease: 'Субаренда',
  agency_contract: 'Агентский договор',
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  generated: 'bg-blue-100 text-blue-700',
  signed: 'bg-green-100 text-green-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
}

const statusLabels: Record<string, string> = {
  draft: 'Черновик', generated: 'Создан', signed: 'Подписан',
  completed: 'Завершён', cancelled: 'Отменён',
}

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawContract } = await supabase
    .from('contracts')
    .select(`*,
      client:clients(full_name, phone),
      owner_contact:contacts!contracts_owner_contact_id_fkey(id, full_name, phone),
      client_contact:contacts!contracts_client_contact_id_fkey(id, full_name, phone),
      property:properties(id, title, address),
      manager:users(full_name)
    `)
    .eq('id', id)
    .single()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contract = rawContract as any

  if (!contract) notFound()

  // Поддержка старого и нового формата
  const ownerContact  = contract.owner_contact  as { id?: string; full_name?: string; phone?: string } | null
  const clientContact = contract.client_contact as { id?: string; full_name?: string; phone?: string } | null
  const legacyClient  = contract.client         as { full_name?: string; phone?: string } | null

  const client   = clientContact  ?? legacyClient
  const owner    = ownerContact
  const property = contract.property as { id?: string; title?: string; address?: string } | null
  const manager  = contract.manager  as { full_name?: string } | null

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/contracts" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Все договоры
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center">
            <FileText className="w-7 h-7 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {contract.contract_number ?? `Договор #${contract.id.slice(0, 8)}`}
            </h1>
            <p className="text-muted-foreground text-sm">{contractTypeLabels[contract.contract_type] ?? contract.contract_type}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm px-3 py-1.5 rounded-xl font-medium ${statusColors[contract.status] ?? 'bg-gray-100'}`}>
            {statusLabels[contract.status] ?? contract.status}
          </span>
          <Link href={`/contracts/${id}/edit`}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm font-medium hover:bg-accent transition">
            <Edit className="w-4 h-4" />
            Редактировать
          </Link>
          <DeleteContractButton contractId={id} />
          <Link href={`/contracts/${id}/generate`}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition">
            <FileText className="w-4 h-4" />
            Сформировать DOCX
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">

          {/* Parties */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-semibold text-foreground mb-4">Стороны договора</h2>
            <div className="grid grid-cols-2 gap-4">
              {/* Собственник */}
              <div className="p-4 bg-muted/30 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-4 h-4 text-orange-500" />
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Собственник</span>
                </div>
                {owner ? (
                  <div>
                    {ownerContact?.id ? (
                      <Link href={`/contacts/${ownerContact.id}`} className="text-sm font-medium text-primary hover:underline">
                        {owner.full_name}
                      </Link>
                    ) : (
                      <p className="text-sm font-medium text-foreground">{owner.full_name}</p>
                    )}
                    {owner.phone && <p className="text-xs text-muted-foreground mt-0.5">{owner.phone}</p>}
                  </div>
                ) : <p className="text-sm text-muted-foreground">Не указан</p>}
              </div>

              {/* Клиент */}
              <div className="p-4 bg-muted/30 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-blue-500" />
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Клиент</span>
                </div>
                {client ? (
                  <div>
                    {clientContact?.id ? (
                      <Link href={`/contacts/${clientContact.id}`} className="text-sm font-medium text-primary hover:underline">
                        {client.full_name}
                      </Link>
                    ) : (
                      <p className="text-sm font-medium text-foreground">{client.full_name}</p>
                    )}
                    {client.phone && <p className="text-xs text-muted-foreground mt-0.5">{client.phone}</p>}
                  </div>
                ) : <p className="text-sm text-muted-foreground">Не указан</p>}
              </div>
            </div>
          </div>

          {/* Property */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">Объект</h2>
              {!property && (
                <Link href="/properties/new" target="_blank"
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition font-medium">
                  <Home className="w-3 h-3" />
                  Создать объект
                </Link>
              )}
            </div>
            {property ? (
              <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-xl">
                <Home className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <Link href={`/properties/${property.id ?? contract.property_id}`} className="text-sm font-medium text-primary hover:underline">
                    {property.title}
                  </Link>
                  {property.address && <p className="text-xs text-muted-foreground mt-0.5">{property.address}</p>}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Объект не привязан</p>
            )}
          </div>

          {/* Finance */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-semibold text-foreground mb-4">Финансы</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-xl">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Сумма</p>
                  <p className="text-lg font-bold text-foreground">
                    {contract.amount ? `${Number(contract.amount).toLocaleString('ru-RU')} ₽` : '—'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-xl">
                <DollarSign className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Залог</p>
                  <p className="text-lg font-bold text-foreground">
                    {contract.deposit ? `${Number(contract.deposit).toLocaleString('ru-RU')} ₽` : '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-semibold text-foreground mb-4">Сроки</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Начало</p>
                  <p className="text-sm font-medium text-foreground">
                    {contract.start_date ? new Date(contract.start_date).toLocaleDateString('ru-RU') : '—'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Окончание</p>
                  <p className="text-sm font-medium text-foreground">
                    {contract.end_date ? new Date(contract.end_date).toLocaleDateString('ru-RU') : '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {contract.notes && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <h2 className="font-semibold text-foreground mb-3">Примечания</h2>
              <p className="text-sm text-foreground leading-relaxed">{contract.notes}</p>
            </div>
          )}
          {/* Payments */}
          <PaymentsSection contractId={id} />
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-semibold text-foreground mb-4">Информация</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Статус</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[contract.status]}`}>
                  {statusLabels[contract.status]}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Менеджер</span>
                <span className="text-foreground">{manager?.full_name ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Создан</span>
                <span className="text-foreground">
                  {new Date(contract.created_at).toLocaleDateString('ru-RU')}
                </span>
              </div>
            </div>
          </div>

          {/* Change status */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-semibold text-foreground mb-3">Действия</h2>
            <div className="space-y-2">
              <Link href={`/contracts/new?duplicate=${id}`}
                className="w-full flex items-center gap-2 px-4 py-2.5 bg-primary/10 text-primary rounded-xl text-sm font-medium hover:bg-primary/20 transition-all">
                <FileText className="w-4 h-4" />
                Скопировать договор
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
