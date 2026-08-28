import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, TrendingUp, User, Building2, Home, DollarSign, Edit } from 'lucide-react'
import { DeleteDealButton } from '@/features/deals/components/DeleteDealButton'
import { DealComments } from '@/features/deals/components/DealComments'
import { DealStatusSelector } from '@/features/deals/components/DealStatusSelector'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { CONTRACT_TYPE_LABELS } from '@/features/contracts/config/contract-types'

const dealTypeLabels: Record<string, string> = {
 rent: 'Аренда', sale: 'Продажа',
 management: 'Управление', commercial: 'Коммерция', subrent: 'Субаренда',
}

const contractStatusLabels: Record<string, string> = {
 draft: 'Черновик', generated: 'Создан', signed: 'Подписан',
 completed: 'Завершён', cancelled: 'Отменён',
}


export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
 const { id } = await params
 const supabase = await createClient()
 const { data: { user } } = await supabase.auth.getUser()

 const [dealResult, commentsResult, contractsResult] = await Promise.all([
 supabase
 .from('deals')
 .select(`
 *,
 client:clients(full_name, phone),
 property:properties(id, title, address),
 manager:users(full_name),
 owner_contact:contacts!deals_owner_contact_id_fkey(id, full_name, phone),
 client_contact:contacts!deals_client_contact_id_fkey(id, full_name, phone)
 `)
 .eq('id', id)
 .single(),

 supabase
 .from('deal_comments')
 .select('id, body, created_at, author:users!deal_comments_author_id_fkey(id, full_name, avatar_url)')
 .eq('deal_id', id)
 .order('created_at', { ascending: true }),

 supabase
 .from('contracts')
 .select('id, contract_number, contract_type, status')
 .eq('deal_id', id)
 .order('created_at', { ascending: false }),
 ])

 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const deal = dealResult.data as any
 if (dealResult.error && dealResult.error.code !== 'PGRST116') {
 throw new Error(`Не удалось загрузить сделку: ${dealResult.error.message}`)
 }
 if (!deal) notFound()

 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const comments = (commentsResult.data ?? []) as any[]
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const linkedContracts = (contractsResult.data ?? []) as any[]

 const ownerContact = deal.owner_contact as { id?: string; full_name?: string; phone?: string } | null
 const clientContact = deal.client_contact as { id?: string; full_name?: string; phone?: string } | null
 const legacyClient = deal.client as { full_name?: string; phone?: string } | null
 const property = deal.property as { id?: string; title?: string; address?: string } | null
 const manager = deal.manager as { full_name?: string } | null

 const ownerName = ownerContact?.full_name
 const clientName = clientContact?.full_name || legacyClient?.full_name

 return (
 <div className="max-w-4xl mx-auto space-y-6">
 <PageHeader
 title={dealTypeLabels[deal.deal_type] ?? deal.deal_type}
 subtitle={`Создана ${new Date(deal.created_at).toLocaleDateString('ru-RU')}`}
 backHref="/deals"
 backLabel="Все сделки"
 iconBg="bg-green-100"
 iconBoxClassName="w-14 h-14"
 icon={<TrendingUp className="w-7 h-7 text-green-600" />}
 actions={
 <>
 <DealStatusSelector dealId={id} currentStatus={deal.status} />
 <Link
 href={`/deals/${id}/edit`}
 className="flex items-center gap-2 px-4 py-2 border border-border text-sm font-medium hover:bg-accent transition whitespace-nowrap"
 >
 <Edit className="w-4 h-4" />
 Редактировать
 </Link>
 <DeleteDealButton dealId={id} />
 </>
 }
 />

 <div className="grid lg:grid-cols-3 gap-6">
 <div className="lg:col-span-2 space-y-4">

 {/* Parties */}
 <div className="bg-white border border-slate-100 shadow-sm p-5">
 <h2 className="font-semibold text-foreground mb-4">Стороны сделки</h2>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div className="p-4 bg-muted/30">
 <div className="flex items-center gap-2 mb-2">
 <Building2 className="w-4 h-4 text-orange-500" />
 <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Собственник</span>
 </div>
 {ownerName ? (
 <div>
 {ownerContact?.id ? (
 <Link href={`/contacts/${ownerContact.id}`} className="text-sm font-medium text-primary hover:underline">
 {ownerName}
 </Link>
 ) : (
 <p className="text-sm font-medium text-foreground">{ownerName}</p>
 )}
 {ownerContact?.phone && <p className="text-xs text-muted-foreground mt-0.5">{ownerContact.phone}</p>}
 </div>
 ) : (
 <div className="space-y-1">
 <p className="text-sm text-muted-foreground">Не указан</p>
 <Link href="/contacts/new" className="text-xs text-primary hover:underline">+ Добавить</Link>
 </div>
 )}
 </div>

 <div className="p-4 bg-muted/30">
 <div className="flex items-center gap-2 mb-2">
 <User className="w-4 h-4 text-blue-500" />
 <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Клиент</span>
 </div>
 {clientName ? (
 <div>
 {clientContact?.id ? (
 <Link href={`/contacts/${clientContact.id}`} className="text-sm font-medium text-primary hover:underline">
 {clientName}
 </Link>
 ) : (
 <p className="text-sm font-medium text-foreground">{clientName}</p>
 )}
 {(clientContact?.phone || legacyClient?.phone) && (
 <p className="text-xs text-muted-foreground mt-0.5">
 {clientContact?.phone ?? legacyClient?.phone}
 </p>
 )}
 </div>
 ) : (
 <div className="space-y-1">
 <p className="text-sm text-muted-foreground">Не указан</p>
 <Link href="/contacts/new" className="text-xs text-primary hover:underline">+ Добавить</Link>
 </div>
 )}
 </div>
 </div>
 </div>

 {/* Property */}
 <div className="bg-white border border-slate-100 shadow-sm p-5">
 <div className="flex items-center justify-between mb-4">
 <h2 className="font-semibold text-foreground">Объект</h2>
 {!property && (
 <Link
 href="/properties/new"
 target="_blank"
 className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition font-medium"
 >
 <Home className="w-3 h-3" />
 Создать объект
 </Link>
 )}
 </div>
 {property ? (
 <div className="flex items-start gap-3 p-3 bg-muted/30">
 <Home className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
 <div>
 <Link href={`/properties/${property.id}`} className="text-sm font-medium text-primary hover:underline">
 {property.title}
 </Link>
 {property.address && <p className="text-xs text-muted-foreground mt-0.5">{property.address}</p>}
 </div>
 </div>
 ) : (
 <p className="text-sm text-muted-foreground">Объект не привязан</p>
 )}
 </div>

 {/* Contracts */}
 <div className="bg-white border border-slate-100 shadow-sm p-5">
 <div className="flex items-center justify-between mb-4">
 <h2 className="font-semibold text-foreground">Договоры</h2>
 <Link
 href={`/contracts/new?deal_id=${id}`}
 className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition font-medium"
 >
 Создать договор
 </Link>
 </div>
 {linkedContracts.length > 0 ? (
 <div className="space-y-2">
 {linkedContracts.map((c) => (
 <Link key={c.id} href={`/contracts/${c.id}`}
 className="flex items-center justify-between gap-3 p-3 bg-muted/30 hover:bg-muted/60 transition">
 <span className="text-sm font-medium text-primary">
 {c.contract_number ?? `Договор #${c.id.slice(0, 8)}`}
 </span>
 <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-violet-100 text-violet-700 shrink-0 whitespace-nowrap">
 {contractStatusLabels[c.status] ?? c.status}
 </span>
 </Link>
 ))}
 </div>
 ) : (
 <p className="text-sm text-muted-foreground">Пока не создан. Стадия сделки продвинется сама, как только договор появится.</p>
 )}
 </div>

 {/* Notes */}
 {deal.notes && (
 <div className="bg-white border border-slate-100 shadow-sm p-5">
 <h2 className="font-semibold text-foreground mb-3">Примечания</h2>
 <p className="text-sm text-foreground whitespace-pre-wrap">{deal.notes}</p>
 </div>
 )}

 {/* Comments */}
 <DealComments
 dealId={id}
 comments={comments}
 currentUserId={user?.id ?? ''}
 />
 </div>

 {/* Right column */}
 <div className="space-y-4">
 <div className="bg-white border border-slate-100 shadow-sm p-5">
 <h2 className="font-semibold text-foreground mb-4">Финансы</h2>
 <div className="space-y-3 text-sm">
 {deal.amount && (
 <div className="flex items-center gap-2 p-3 bg-green-50">
 <DollarSign className="w-4 h-4 text-green-600" />
 <div>
 <p className="text-xs text-muted-foreground">Сумма сделки</p>
 <p className="font-bold text-green-700">{Number(deal.amount).toLocaleString('ru-RU')} ₽</p>
 </div>
 </div>
 )}
 {deal.commission && (
 <div className="flex items-center gap-2 p-3 bg-muted/30">
 <DollarSign className="w-4 h-4 text-muted-foreground" />
 <div>
 <p className="text-xs text-muted-foreground">Комиссия</p>
 <p className="font-semibold text-foreground">{Number(deal.commission).toLocaleString('ru-RU')} ₽</p>
 </div>
 </div>
 )}
 </div>
 </div>

 <div className="bg-white border border-slate-100 shadow-sm p-5">
 <h2 className="font-semibold text-foreground mb-4">Информация</h2>
 <div className="space-y-2 text-sm">
 <div className="flex justify-between">
 <span className="text-muted-foreground">Менеджер</span>
 <span className="text-foreground">{manager?.full_name ?? '—'}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-muted-foreground">Создана</span>
 <span className="text-foreground">{new Date(deal.created_at).toLocaleDateString('ru-RU')}</span>
 </div>
 </div>
 </div>

 {/* Quick actions */}
 <div className="bg-white border border-slate-100 shadow-sm p-4 space-y-2">
 <Link
 href={`/tasks/new?deal_id=${id}`}
 className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-border text-sm font-medium hover:bg-accent transition"
 >
 + Задача
 </Link>
 <Link
 href={`/contracts/new?deal_id=${id}`}
 className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition"
 >
 + Договор
 </Link>
 </div>
 </div>
 </div>
 </div>
 )
}
