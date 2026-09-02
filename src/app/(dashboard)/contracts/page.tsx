import { createClient } from '@/lib/supabase/server'
import { FileText, Plus, Search, User, Home } from 'lucide-react'
import Link from 'next/link'
import { CONTRACT_TYPE_LABELS } from '@/features/contracts/config/contract-types'
import { PageHeader } from '@/components/layout/PageHeader'
import { buttonVariants } from '@/components/ui/button'
import { formatDate, isId } from '@/lib/utils'

const contractTypeLabels = CONTRACT_TYPE_LABELS
const statusConfig: Record<string, { label: string; cls: string; dot: string }> = {
 draft: { label: 'Черновик', cls: 'bg-[var(--hp-neutral-tint)] text-[var(--hp-sub)]', dot: 'bg-[var(--hp-tertiary)]' },
 generated: { label: 'Создан', cls: 'bg-[var(--hp-info-tint)] text-[var(--hp-info)]', dot: 'bg-[var(--hp-info)]' },
 signed: { label: 'Подписан', cls: 'bg-[var(--hp-good-tint)] text-[var(--hp-good)]', dot: 'bg-[var(--hp-accent)]' },
 completed: { label: 'Завершён', cls: 'bg-[var(--hp-good-tint)] text-[var(--hp-good)]', dot: 'bg-[var(--hp-accent)]' },
 cancelled: { label: 'Отменён', cls: 'bg-[var(--hp-danger-tint)] text-[var(--hp-danger)]', dot: 'bg-[var(--hp-danger)]' },
}

export default async function ContractsPage({
 searchParams,
}: {
 searchParams: Promise<{ search?: string; status?: string }>
}) {
 const params = await searchParams
 const supabase = await createClient()

 let query = supabase
 .from('contracts')
 .select('id, contract_number, contract_type, status, amount, client_id, client_contact_id, property_id, created_at')
 .order('created_at', { ascending: false })

 if (params.search) query = query.ilike('contract_number', `%${params.search}%`)
 if (params.status) query = query.eq('status', params.status)

 const { data: contracts, error } = await query.limit(50)

 const contactIds = [...new Set([
 ...(contracts?.map(c => c.client_contact_id).filter(isId) ?? []),
 ...(contracts?.map(c => c.client_id).filter(isId) ?? []),
 ])]
 const propertyIds = [...new Set(contracts?.map(c => c.property_id).filter(isId) ?? [])]

 const [{ data: contactsData }, { data: propertiesData }] = await Promise.all([
 contactIds.length > 0
 ? supabase.from('contacts').select('id, full_name').in('id', contactIds)
 : Promise.resolve({ data: [] }),
 propertyIds.length > 0
 ? supabase.from('properties').select('id, address, title').in('id', propertyIds)
 : Promise.resolve({ data: [] }),
 ])

 // Запасной путь через legacy-таблицу clients убран 02.09.2026: договоров со
 // ссылкой client_id без client_contact_id в базе нет ни одного, а сама таблица
 // содержит одну запись, которая уже есть в contacts. Имена берутся из contacts.
 const clientMap = Object.fromEntries((contactsData ?? []).map(c => [c.id, c]))
 const propertyMap = Object.fromEntries((propertiesData ?? []).map(p => [p.id, p]))

 const statusKeys = Object.keys(statusConfig)

 return (
 <div className="space-y-6">
 <PageHeader
 title="Договоры"
 subtitle={`${contracts?.length ?? 0} договоров`}
 actions={
 <Link href="/contracts/new" className={buttonVariants({ size: 'sm' })}>
 <Plus style={{ width: 16, height: 16 }} />
 Новый договор
 </Link>
 }
 />

 {/* Filters */}
 <div className="hp-card p-4 flex flex-wrap gap-3">
 <form method="get" className="flex-1 min-w-64">
 <div className="relative">
 <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--hp-tertiary)]"
 style={{ width: 15, height: 15 }} />
 <input name="search" defaultValue={params.search}
 placeholder="Поиск по номеру договора..."
 className="w-full h-10 pl-10 pr-4 text-sm text-foreground placeholder:text-[var(--hp-tertiary)] outline-none bg-[var(--hp-neutral-tint)] border border-[var(--hp-border)] focus:border-[var(--hp-border)] focus:ring-2 focus:ring-green-100 transition-all" />
 </div>
 </form>
 <div className="flex gap-2 flex-wrap">
 <Link href="/contracts"
 className={`px-4 py-2 text-sm font-semibold transition-colors ${!params.status ? 'text-white' : 'bg-[var(--hp-neutral-tint)] text-[var(--hp-sub)] hover:bg-[var(--hp-tertiary)]'}`}
 style={!params.status ? { background: 'var(--hp-accent)' } : {}}>
 Все
 </Link>
 {statusKeys.map(value => (
 <Link key={value} href={`/contracts?status=${value}`}
 className={`px-4 py-2 text-sm font-semibold transition-colors ${params.status === value ? 'text-white' : 'bg-[var(--hp-neutral-tint)] text-[var(--hp-sub)] hover:bg-[var(--hp-tertiary)]'}`}
 style={params.status === value ? { background: 'var(--hp-accent)' } : {}}>
 {statusConfig[value].label}
 </Link>
 ))}
 </div>
 </div>

 {/* Table */}
 <div className="hp-card overflow-hidden">
 {!contracts || contracts.length === 0 ? (
 <div className="text-center py-16">
 <div className="w-12 h-12 rounded-[var(--hp-radius)] bg-[var(--hp-neutral-tint)] border border-[var(--hp-border)] flex items-center justify-center mx-auto mb-3">
 <FileText style={{ width: 20, height: 20 }} className="text-[var(--hp-tertiary)]" />
 </div>
 <p className="text-[var(--hp-ink)] font-semibold">
 {error ? `Ошибка: ${error.message}` : 'Нет договоров'}
 </p>
 <Link href="/contracts/new"
 className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 text-white text-sm font-semibold"
 style={{ background: 'var(--hp-accent)', }}>
 <Plus style={{ width: 14, height: 14 }} />
 Создать договор
 </Link>
 </div>
 ) : (
 <>
 {/* Desktop table */}
 <div className="hidden md:block overflow-x-auto">
 <table className="w-full">
 <thead>
 <tr className="bg-[var(--hp-neutral-tint)] border-b border-[var(--hp-border-soft)]">
 {['Номер', 'Тип', 'Клиент', 'Объект', 'Сумма', 'Статус', 'Дата', ''].map(h => (
 <th key={h} className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 py-3.5 first:px-6">{h}</th>
 ))}
 </tr>
 </thead>
 <tbody className="divide-y divide-[var(--hp-border-soft)]">
 {contracts.map(contract => {
 const clientId = contract.client_contact_id || contract.client_id
 const client = clientId ? clientMap[clientId] : null
 const property = contract.property_id ? propertyMap[contract.property_id] : null
 const sc = statusConfig[contract.status] ?? statusConfig.draft

 return (
 <tr key={contract.id} className="hover:bg-[var(--hp-neutral-tint)] transition-colors">
 <td className="px-6 py-4">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 flex items-center justify-center bg-[var(--hp-neutral-tint)] shrink-0">
 <FileText style={{ width: 14, height: 14 }} className="text-[var(--hp-sub)]" />
 </div>
 <span className="text-sm font-semibold text-foreground">
 {contract.contract_number ?? `#${contract.id.slice(0, 8)}`}
 </span>
 </div>
 </td>
 <td className="px-4 py-4 text-sm text-muted-foreground">
 {contractTypeLabels[contract.contract_type] ?? contract.contract_type}
 </td>
 <td className="px-4 py-4 text-sm font-medium text-[var(--hp-ink)]">
 {client?.full_name ?? '—'}
 </td>
 <td className="px-4 py-4 text-sm text-muted-foreground max-w-[200px] truncate">
 {property?.title ?? property?.address ?? '—'}
 </td>
 <td className="px-4 py-4 text-sm font-bold text-foreground">
 {contract.amount ? `${Number(contract.amount).toLocaleString('ru-RU')} ₽` : '—'}
 </td>
 <td className="px-4 py-4">
 <span className={`flex items-center gap-1.5 w-fit text-[11px] font-semibold px-2.5 py-1 rounded-[var(--hp-radius-badge)] ${sc.cls}`}>
 <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
 {sc.label}
 </span>
 </td>
 <td className="px-4 py-4 text-sm text-muted-foreground">
 {formatDate(contract.created_at)}
 </td>
 <td className="px-4 py-4">
 <div className="flex items-center gap-3">
 <Link href={`/contracts/${contract.id}`}
 className="text-sm text-[var(--hp-good)] font-semibold hover:underline">
 Открыть
 </Link>
 <span className="text-[var(--hp-tertiary)]">·</span>
 <Link href={`/contracts/${contract.id}/generate`}
 className="text-sm text-[var(--hp-sub)] font-semibold hover:underline">
 DOCX
 </Link>
 </div>
 </td>
 </tr>
 )
 })}
 </tbody>
 </table>
 </div>

 {/* Mobile cards */}
 <div className="md:hidden divide-y divide-[var(--hp-border-soft)]">
 {contracts.map(contract => {
 const clientId = contract.client_contact_id || contract.client_id
 const client = clientId ? clientMap[clientId] : null
 const property = contract.property_id ? propertyMap[contract.property_id] : null
 const sc = statusConfig[contract.status] ?? statusConfig.draft

 return (
 <Link key={contract.id} href={`/contracts/${contract.id}`} className="block p-4 hover:bg-[var(--hp-neutral-tint)] transition-colors">
 <div className="flex items-start justify-between gap-3 mb-2">
 <div className="flex items-center gap-2.5 min-w-0">
 <div className="w-8 h-8 flex items-center justify-center bg-[var(--hp-neutral-tint)] shrink-0">
 <FileText style={{ width: 13, height: 13 }} className="text-[var(--hp-sub)]" />
 </div>
 <div className="min-w-0">
 <p className="text-sm font-bold text-foreground">
 {contract.contract_number ?? `#${contract.id.slice(0, 8)}`}
 </p>
 <p className="text-xs text-muted-foreground">{contractTypeLabels[contract.contract_type] ?? contract.contract_type}</p>
 </div>
 </div>
 <span className={`shrink-0 flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-[var(--hp-radius-badge)] ${sc.cls}`}>
 <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
 {sc.label}
 </span>
 </div>
 <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground mt-1">
 {client?.full_name && (
 <span className="flex items-center gap-1">
 <User className="w-3 h-3" />
 {client.full_name}
 </span>
 )}
 {(property?.title || property?.address) && (
 <span className="flex items-center gap-1 truncate max-w-[160px]">
 <Home className="w-3 h-3 shrink-0" />
 <span className="truncate">{property.title ?? property.address}</span>
 </span>
 )}
 {contract.amount && (
 <span className="font-bold text-foreground">{Number(contract.amount).toLocaleString('ru-RU')} ₽</span>
 )}
 </div>
 </Link>
 )
 })}
 </div>
 </>
 )}
 </div>
 </div>
 )
}
