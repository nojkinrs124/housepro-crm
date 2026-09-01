import { createClient } from '@/lib/supabase/server'
import { DeleteContractButton } from '@/features/contracts/components/DeleteContractButton'
import { ContractStatusSelector } from '@/features/contracts/components/ContractStatusSelector'
import { ContractVersionHistory } from '@/features/contracts/components/ContractVersionHistory'
import { ArrowLeft, FileText, User, Home, Building2, Calendar, DollarSign, Edit } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PaymentsSection } from '@/features/payments/components/PaymentsSection'
import { CONTRACT_TYPE_LABELS, getContractTypeConfig } from '@/features/contracts/config/contract-types'
import { PageHeader } from '@/components/layout/PageHeader'
import { SendByEmailForm } from '@/components/forms/SendByEmailForm'
import { sendContractByEmailAction } from '@/features/contracts/actions/send-email.actions'
import {
 ContractSigningPanel,
 type SignatureSummary,
} from '@/features/contracts/components/ContractSigningPanel'
import {
 PodpislonSigningPanel,
 type PodpislonSignature,
} from '@/features/contracts/components/PodpislonSigningPanel'
import { getSiteUrl } from '@/lib/telegram/site-url'

const contractTypeLabels = CONTRACT_TYPE_LABELS

const statusColors: Record<string, string> = {
 draft: 'bg-[var(--hp-neutral-tint)] text-[var(--hp-sub)]',
 generated: 'bg-[var(--hp-info-tint)] text-[var(--hp-info)]',
 signed: 'bg-[var(--hp-good-tint)] text-[var(--hp-good)]',
 completed: 'bg-[var(--hp-good-tint)] text-[var(--hp-good)]',
 cancelled: 'bg-[var(--hp-danger-tint)] text-[var(--hp-danger)]',
}

const statusLabels: Record<string, string> = {
 draft: 'Черновик', generated: 'Создан', signed: 'Подписан',
 completed: 'Завершён', cancelled: 'Отменён',
}

const dealTypeLabels: Record<string, string> = {
 rent: 'Аренда', sale: 'Продажа', management: 'Управление', commercial: 'Коммерция', subrent: 'Субаренда',
}
const dealStageLabels: Record<string, string> = {
 new: 'Новая', showing: 'Показы', negotiation: 'Переговоры',
 contract: 'Договор', payment: 'Оплата', completed: 'Завершена', cancelled: 'Отменена',
}

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
 const { id } = await params
 const supabase = await createClient()

 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const { data: rawContract, error: contractError } = await supabase
 .from('contracts')
 .select(`*,
 client:clients(full_name, phone),
 owner_contact:contacts!contracts_owner_contact_id_fkey(id, full_name, phone),
 client_contact:contacts!contracts_client_contact_id_fkey(id, full_name, phone, email),
 property:properties(id, title, address),
 manager:users(full_name),
 deal:deals(id, deal_type, status, amount)
 `)
 .eq('id', id)
 .single()

 // PGRST116 ="не найдено ни одной строки" — это настоящий 404, ведём себя как обычно.
 // Любая ДРУГАЯ ошибка (напр."Could not find a relationship..." при рассинхроне
 // schema cache PostgREST после ALTER TABLE, либо сетевая/конфигурационная ошибка)
 // должна быть видна, а не молча превращаться в 404 — иначе такие баги невозможно
 // отличить от реально отсутствующей записи ни в логах, ни в Sentry.
 if (contractError && contractError.code !== 'PGRST116') {
 throw new Error(`Не удалось загрузить договор: ${contractError.message}`)
 }
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const contract = rawContract as any

 if (!contract) notFound()

 // base_contract — self-referencing FK (contracts.base_contract_id -> contracts.id).
 // PostgREST не всегда надёжно резолвит embed для self-join даже с явным hint'ом
 // на constraint (наблюдали 'Could not find a relationship between contracts and
 // contracts in the schema cache' несмотря на то, что сам constraint существует
 // в БД) — поэтому получаем отдельным простым запросом вместо embed.
 let baseContract: { id: string; contract_number: string | null } | null = null
 if (contract.base_contract_id) {
 const { data } = await supabase
 .from('contracts')
 .select('id, contract_number')
 .eq('id', contract.base_contract_id)
 .maybeSingle()
 baseContract = data
 }

 let company: { name?: string } | null = null
 if (contract.company_profile_id) {
 const { data } = await supabase.from('company_settings').select('name').eq('id', contract.company_profile_id).maybeSingle()
 company = data
 }
 if (!company) {
 const { data } = await supabase.from('company_settings').select('name').eq('is_default', true).maybeSingle()
 company = data
 }

 // История версий
 const { data: contractVersions } = await supabase
 .from('contract_versions')
 .select(`id, version, created_at, note, docx_url, version_data, created_by,
 author:users!contract_versions_created_by_fkey(full_name)`)
 .eq('contract_id', id)
 .order('version', { ascending: false })

 const typeConfig = getContractTypeConfig(contract.contract_type)

 // Поддержка старого и нового формата
 const ownerContact = contract.owner_contact as { id?: string; full_name?: string; phone?: string } | null
 const clientContact = contract.client_contact as { id?: string; full_name?: string; phone?: string; email?: string } | null

 // История подписаний договора: одна ссылка на подписанта, их может быть несколько
 // (переотправка после правок, второй подписант со стороны юрлица).
 const { data: signaturesRaw } = await supabase
 .from('contract_signatures')
 .select(`id, provider, status, signer_email, signer_name, signer_phone, signed_at, created_at,
 expires_at, sign_token, sign_url, signed_document_url`)
 .eq('contract_id', id)
 .order('created_at', { ascending: false })

 // Две подписи живут в одной таблице и различаются провайдером: внутренняя ПЭП
 // по коду из письма и внешняя — через Подпислон по коду из СМС.
 const allSignatures = (signaturesRaw ?? []) as (SignatureSummary & PodpislonSignature & { provider: string })[]
 const signatures = allSignatures.filter((s) => s.provider !== 'podpislon') as SignatureSummary[]
 const podpislonSignatures = allSignatures.filter((s) => s.provider === 'podpislon') as PodpislonSignature[]

 // Панель Подпислона показываем только подключившим интеграцию: RLS отдаёт
 // строку только своей организации, поэтому дополнительный фильтр не нужен.
 const { data: signingIntegration } = await supabase
 .from('channel_integrations')
 .select('provider, is_active')
 .eq('kind', 'signing')
 .maybeSingle()
 const podpislonEnabled = signingIntegration?.provider === 'podpislon' && signingIntegration.is_active
 const legacyClient = contract.client as { full_name?: string; phone?: string } | null

 const client = clientContact ?? legacyClient
 const owner = ownerContact
 const property = contract.property as { id?: string; title?: string; address?: string } | null
 const manager = contract.manager as { full_name?: string } | null
 const deal = contract.deal as { id?: string; deal_type?: string; status?: string; amount?: number } | null

 return (
 <div className="max-w-4xl mx-auto space-y-6">
 <PageHeader
 title={contract.contract_number ?? `Договор #${contract.id.slice(0, 8)}`}
 subtitle={contractTypeLabels[contract.contract_type] ?? contract.contract_type}
 backHref="/contracts"
 backLabel="Все договоры"
 iconBg="bg-[var(--hp-neutral-tint)]"
 iconBoxClassName="w-14 h-14"
 icon={<FileText className="w-7 h-7 text-[var(--hp-sub)]" />}
 actions={
 <>
 <ContractStatusSelector contractId={id} currentStatus={contract.status} />
 <Link href={`/contracts/${id}/edit`}
 className="flex items-center gap-2 px-4 py-2 border border-border text-sm font-medium hover:bg-accent transition whitespace-nowrap">
 <Edit className="w-4 h-4" />
 Редактировать
 </Link>
 <DeleteContractButton contractId={id} />
 <Link href={`/contracts/${id}/generate`}
 className="flex items-center gap-2 px-4 py-2 text-white text-sm font-bold transition whitespace-nowrap" style={{ background: 'var(--hp-accent)', }}>
 <FileText className="w-4 h-4" />
 Сформировать DOCX
 </Link>
 </>
 }
 />

 {/* Подписание простой ЭП — тоже только при готовом файле. */}
 {contract.generated_docx_url && (
 <ContractSigningPanel
 contractId={id}
 defaultEmail={clientContact?.email ?? null}
 signatures={signatures}
 siteUrl={getSiteUrl()}
 />
 )}

 {/* Подпись через внешнего оператора ПЭП — код из СМС, согласия в файле. */}
 {contract.generated_docx_url && podpislonEnabled && (
 <PodpislonSigningPanel
 contractId={id}
 defaultName={clientContact?.full_name ?? null}
 defaultPhone={clientContact?.phone ?? null}
 signatures={podpislonSignatures}
 />
 )}

 {/* Отправка договора клиенту письмом — только когда файл уже сформирован:
 без вложения письмо бессмысленно, а кнопка-обманка хуже её отсутствия. */}
 {contract.generated_docx_url && (
 <SendByEmailForm
 action={sendContractByEmailAction.bind(null, id)}
 defaultEmail={clientContact?.email ?? null}
 title="Отправить договор клиенту"
 hint="Письмо уйдёт с вложенным DOCX последней версии."
 submitLabel="Отправить договор"
 />
 )}

 <div className="grid lg:grid-cols-3 gap-6">
 <div className="lg:col-span-2 space-y-4">

 {/* Parties */}
 <div className="hp-card p-5">
 <h2 className="font-semibold text-foreground mb-4">Стороны договора</h2>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 {/* Сторона 1 */}
 <div className="p-4 bg-muted/30">
 <div className="flex items-center gap-2 mb-2">
 <Building2 className="w-4 h-4 text-[var(--hp-warn)]" />
 <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
 {typeConfig?.party1Label ?? 'Собственник'}
 </span>
 </div>
 {typeConfig?.party1Role === 'agency' ? (
 <p className="text-sm font-medium text-foreground">{company?.name || 'HousePro'}</p>
 ) : owner ? (
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

 {/* Сторона 2 */}
 <div className="p-4 bg-muted/30">
 <div className="flex items-center gap-2 mb-2">
 <User className="w-4 h-4 text-[var(--hp-info)]" />
 <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
 {typeConfig?.party2Label ?? 'Клиент'}
 </span>
 </div>
 {(typeConfig?.party2Role === 'owner' ? owner : client) ? (
 typeConfig?.party2Role === 'owner' ? (
 <div>
 {ownerContact?.id ? (
 <Link href={`/contacts/${ownerContact.id}`} className="text-sm font-medium text-primary hover:underline">
 {owner!.full_name}
 </Link>
 ) : (
 <p className="text-sm font-medium text-foreground">{owner!.full_name}</p>
 )}
 {owner!.phone && <p className="text-xs text-muted-foreground mt-0.5">{owner!.phone}</p>}
 </div>
 ) : (
 <div>
 {clientContact?.id ? (
 <Link href={`/contacts/${clientContact.id}`} className="text-sm font-medium text-primary hover:underline">
 {client!.full_name}
 </Link>
 ) : (
 <p className="text-sm font-medium text-foreground">{client!.full_name}</p>
 )}
 {client!.phone && <p className="text-xs text-muted-foreground mt-0.5">{client!.phone}</p>}
 </div>
 )
 ) : <p className="text-sm text-muted-foreground">Не указан</p>}
 </div>
 </div>
 </div>

 {/* Договор-основание (субаренда) */}
 {typeConfig?.requiresBaseContract && (
 <div className="hp-card p-5">
 <h2 className="font-semibold text-foreground mb-3">Договор-основание</h2>
 {baseContract?.id ? (
 <Link href={`/contracts/${baseContract.id}`} className="text-sm font-medium text-primary hover:underline">
 {baseContract.contract_number ?? `#${baseContract.id.slice(0, 8)}`}
 </Link>
 ) : (
 <p className="text-sm text-muted-foreground">Не указан</p>
 )}
 </div>
 )}

 {/* Property */}
 <div className="hp-card p-5">
 <div className="flex items-center justify-between mb-4">
 <h2 className="font-semibold text-foreground">Объект</h2>
 {!property && (
 <Link href="/properties/new" target="_blank"
 className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-[var(--hp-good-tint)] text-[var(--hp-good)] border border-[var(--hp-border)] hover:bg-[var(--hp-good-tint)] transition font-medium">
 <Home className="w-3 h-3" />
 Создать объект
 </Link>
 )}
 </div>
 {property ? (
 <div className="flex items-start gap-3 p-3 bg-muted/30">
 <Home className="w-4 h-4 text-[var(--hp-good)] mt-0.5 shrink-0" />
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

 {/* Deal */}
 <div className="hp-card p-5">
 <h2 className="font-semibold text-foreground mb-4">Сделка</h2>
 {deal?.id ? (
 <div className="flex items-center justify-between gap-3 p-3 bg-muted/30">
 <div>
 <Link href={`/deals/${deal.id}`} className="text-sm font-medium text-primary hover:underline">
 {dealTypeLabels[deal.deal_type ?? ''] ?? deal.deal_type}
 {deal.amount ? ` · ${Number(deal.amount).toLocaleString('ru-RU')} ₽` : ''}
 </Link>
 <p className="text-xs text-muted-foreground mt-0.5">
 Стадия сделки двигается автоматически: создание договора, формирование DOCX и оплата продвигают её сами.
 </p>
 </div>
 <span className="text-xs px-2.5 py-1 rounded-[var(--hp-radius-badge)] font-medium bg-[var(--hp-good-tint)] text-[var(--hp-good)] shrink-0 whitespace-nowrap">
 {dealStageLabels[deal.status ?? ''] ?? deal.status}
 </span>
 </div>
 ) : (
 <p className="text-sm text-muted-foreground">Не привязан к сделке — привяжите в «Редактировать», чтобы стадия сделки двигалась автоматически.</p>
 )}
 </div>

 {/* Finance */}
 <div className="hp-card p-5">
 <h2 className="font-semibold text-foreground mb-4">Финансы</h2>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div className="flex items-center gap-3 p-4 bg-muted/30">
 <DollarSign className="w-5 h-5 text-[var(--hp-good)]" />
 <div>
 <p className="text-xs text-muted-foreground">Сумма</p>
 <p className="text-lg font-bold text-foreground">
 {contract.amount ? `${Number(contract.amount).toLocaleString('ru-RU')} ₽` : '—'}
 </p>
 </div>
 </div>
 <div className="flex items-center gap-3 p-4 bg-muted/30">
 <DollarSign className="w-5 h-5 text-[var(--hp-info)]" />
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
 <div className="hp-card p-5">
 <h2 className="font-semibold text-foreground mb-4">Сроки</h2>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
 <div className="hp-card p-5">
 <h2 className="font-semibold text-foreground mb-3">Примечания</h2>
 <p className="text-sm text-foreground leading-relaxed">{contract.notes}</p>
 </div>
 )}
 {/* Payments */}
 <PaymentsSection contractId={id} />

 {/* Version history */}
 {contractVersions && contractVersions.length > 0 && (
 <ContractVersionHistory
 contractId={id}
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 versions={contractVersions as any}
 />
 )}
 </div>

 {/* Right sidebar */}
 <div className="space-y-4">
 <div className="hp-card p-5">
 <h2 className="font-semibold text-foreground mb-4">Информация</h2>
 <div className="space-y-3 text-sm">
 <div className="flex justify-between">
 <span className="text-muted-foreground">Статус</span>
 <span className={`text-xs px-2 py-0.5 rounded-[var(--hp-radius-badge)] font-medium ${statusColors[contract.status]}`}>
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
 <div className="hp-card p-5">
 <h2 className="font-semibold text-foreground mb-3">Действия</h2>
 <div className="space-y-2">
 <Link href={`/contracts/new?duplicate=${id}`}
 className="w-full flex items-center gap-2 px-4 py-2.5 bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-all">
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
