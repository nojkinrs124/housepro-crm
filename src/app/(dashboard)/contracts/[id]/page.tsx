import { createClient } from '@/lib/supabase/server'
import { deleteContractAction } from '@/features/contracts/actions/contracts.actions'
import { GenerateButton } from './generate/GenerateButton'
import { RecordActions } from '@/components/layout/RecordActions'
import { ConfirmDeleteButton } from '@/components/forms/ConfirmDeleteButton'
import { StatStrip } from '@/components/layout/StatStrip'
import { ContractStatusSelector } from '@/features/contracts/components/ContractStatusSelector'
import { ContractVersionHistory } from '@/features/contracts/components/ContractVersionHistory'
import { FileText, User, Home, Building2, Edit, TrendingUp, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PaymentsSection } from '@/features/payments/components/PaymentsSection'
import { CONTRACT_TYPE_LABELS, getContractTypeConfig } from '@/features/contracts/config/contract-types'
import { PageHeader } from '@/components/layout/PageHeader'
import { ReadinessPanel } from '@/components/layout/ReadinessPanel'
import { checkContract } from '@/lib/readiness'
import { SendByEmailForm } from '@/components/forms/SendByEmailForm'
import { sendContractByEmailAction } from '@/features/contracts/actions/send-email.actions'
import { DEAL_TYPE_LABELS as dealTypeLabels, DEAL_STATUS_LABELS as dealStageLabels } from '@/features/deals/config/deal-stages'
import { formatDate, formatAmount } from '@/lib/utils'

const contractTypeLabels = CONTRACT_TYPE_LABELS

const statusLabels: Record<string, string> = {
 draft: 'Черновик', generated: 'Создан', signed: 'Подписан',
 completed: 'Завершён', cancelled: 'Отменён',
}


export default async function ContractPage({
 params,
 searchParams,
}: {
 params: Promise<{ id: string }>
 searchParams: Promise<{ created?: string }>
}) {
 const { id } = await params
 // Мастер оформления сделки перечисляет в этом параметре, что он создал:
 // договор, начисления, задачу, статус объекта — иначе результат цепочки
 // виден только по разным разделам.
 const { created } = await searchParams
 const supabase = await createClient()

 const { data: rawContract, error: contractError } = await supabase
 .from('contracts')
 .select(`*,
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
 const contract = rawContract

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

 let company: { name: string | null } | null = null
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

 // Панели подписания (внутренняя ПЭП и Подпислон) скрыты: подписей 0,
 // см. docs/HIDDEN.md — вместе с запросами contract_signatures и channel_integrations.

 const client = clientContact
 const owner = ownerContact
 const property = contract.property as { id?: string; title?: string; address?: string } | null
 const manager = contract.manager as { full_name?: string } | null
 const deal = contract.deal as { id?: string; deal_type?: string; status?: string; amount?: number } | null

 const issues = checkContract(contract)

 const number = contract.contract_number ?? `Договор #${contract.id.slice(0, 8)}`
 const typeLabel = contractTypeLabels[contract.contract_type] ?? contract.contract_type
 const party1Name = typeConfig?.party1Role === 'agency' ? (company?.name || 'Агентство') : owner?.full_name
 const party2 = typeConfig?.party2Role === 'owner' ? owner : client
 const party2Contact = typeConfig?.party2Role === 'owner' ? ownerContact : clientContact

 return (
 <div className="max-w-5xl mx-auto space-y-5">
 <PageHeader
 crumbs={[{ label: 'Договоры', href: '/contracts' }, { label: number }]}
 title={`${typeLabel} ${contract.contract_number ? `№ ${contract.contract_number}` : ''}`.trim()}
 badges={<ContractStatusSelector contractId={id} currentStatus={contract.status} />}
 meta={
 <>
 <span>создан {formatDate(contract.created_at)}</span>
 {manager?.full_name && (<><span className="sep">·</span><span>риелтор {manager.full_name}</span></>)}
 {company?.name && (<><span className="sep">·</span><span>от лица {company.name}</span></>)}
 </>
 }
 actions={
 <RecordActions
 /* Главное действие договора — получить документ. Кнопка формирует DOCX
 прямо здесь: раньше для этого был отдельный переход на /generate. */
 primary={<GenerateButton contractId={id} />}
 secondary={
 <Link href={`/contracts/${id}/edit`} className="hp-btn-secondary" data-testid="contract-edit">
 <Edit className="w-4 h-4" />
 Редактировать
 </Link>
 }
 more={
 <>
 <Link href={`/contracts/${id}/generate`} className="hp-menu-item" role="menuitem">
 <FileText className="w-4 h-4" />
 Проверить данные для документа
 </Link>
 <ConfirmDeleteButton
 action={deleteContractAction.bind(null, id)}
 confirmText={`Удалить ${typeLabel.toLowerCase()} ${contract.contract_number ? `№ ${contract.contract_number}` : ''}? Сформированные файлы и начисления по нему тоже удалятся. Отменить нельзя.`}
 label="Удалить договор"
 />
 </>
 }
 />
 }
 />

 {created && (
 <div className="hp-block">
 <div className="hp-block-header">Сделка оформлена</div>
 <div className="hp-block-item">
 <span className="mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 bg-[var(--hp-good)]" />
 <span className="flex-1 min-w-0 text-[var(--hp-ink)]">Создано: {created}</span>
 </div>
 </div>
 )}

 <ReadinessPanel issues={issues} />

 <StatStrip
 items={[
 { label: 'Сумма', value: contract.amount ? <>{formatAmount(contract.amount)} <span className="text-[var(--hp-tertiary)]">₽</span></> : '—' },
 { label: 'Залог', value: contract.deposit ? <>{formatAmount(contract.deposit)} <span className="text-[var(--hp-tertiary)]">₽</span></> : '—' },
 { label: 'Начало', small: true, value: contract.start_date ? formatDate(contract.start_date) : '—' },
 { label: 'Окончание', small: true, value: contract.end_date ? formatDate(contract.end_date) : '—' },
 ]}
 />

 <div className="grid lg:grid-cols-3 gap-4 items-start">
 <div className="lg:col-span-2 space-y-4">

 {/* Стороны */}
 <div className="hp-block">
 <div className="hp-block-header">Стороны договора</div>
 <div className="hp-block-item">
 <Building2 className="w-4 h-4 shrink-0 text-[var(--hp-sub)]" />
 <span className="flex-1 min-w-0">
 <span className="block text-[11px] uppercase tracking-wide text-[var(--hp-tertiary)]">{typeConfig?.party1Label ?? 'Собственник'}</span>
 {typeConfig?.party1Role === 'agency' || !ownerContact?.id ? (
 <span className="block truncate text-[var(--hp-ink)] font-medium">{party1Name ?? <span className="text-[var(--hp-tertiary)] font-normal">не указан</span>}</span>
 ) : (
 <Link href={`/contacts/${ownerContact.id}`} className="block truncate text-[var(--hp-ink)] font-medium hover:text-[var(--hp-accent)] transition-colors">{party1Name}</Link>
 )}
 </span>
 {typeConfig?.party1Role !== 'agency' && owner?.phone && <span className="shrink-0 text-[12px] text-[var(--hp-sub)]">{owner.phone}</span>}
 </div>
 <div className="hp-block-item">
 <User className="w-4 h-4 shrink-0 text-[var(--hp-sub)]" />
 <span className="flex-1 min-w-0">
 <span className="block text-[11px] uppercase tracking-wide text-[var(--hp-tertiary)]">{typeConfig?.party2Label ?? 'Клиент'}</span>
 {party2 ? (
 party2Contact?.id
 ? <Link href={`/contacts/${party2Contact.id}`} className="block truncate text-[var(--hp-ink)] font-medium hover:text-[var(--hp-accent)] transition-colors">{party2.full_name}</Link>
 : <span className="block truncate text-[var(--hp-ink)] font-medium">{party2.full_name}</span>
 ) : (
 <span className="block text-[var(--hp-tertiary)]">не указан</span>
 )}
 </span>
 {party2?.phone && <span className="shrink-0 text-[12px] text-[var(--hp-sub)]">{party2.phone}</span>}
 </div>
 </div>

 {/* Объект и сделка */}
 <div className="hp-block">
 <div className="hp-block-header flex items-center justify-between">
 <span>Объект и сделка</span>
 {!property && (
 <Link href="/properties/new" target="_blank"
 className="flex items-center gap-1 normal-case tracking-normal text-[11px] font-semibold text-[var(--hp-sub)] hover:text-[var(--hp-ink)] transition-colors">
 Создать объект
 <ExternalLink className="w-3 h-3" />
 </Link>
 )}
 </div>
 {property ? (
 <Link href={`/properties/${property.id ?? contract.property_id}`} className="hp-block-item">
 <Home className="w-4 h-4 shrink-0 text-[var(--hp-sub)]" />
 <span className="flex-1 min-w-0">
 <span className="block truncate text-[var(--hp-ink)] font-medium">{property.title}</span>
 {property.address && <span className="block text-[11.5px] text-[var(--hp-sub)] truncate">{property.address}</span>}
 </span>
 </Link>
 ) : (
 <div className="hp-block-item text-[var(--hp-tertiary)]"><Home className="w-4 h-4 shrink-0" />Объект не привязан</div>
 )}
 {deal?.id ? (
 <Link href={`/deals/${deal.id}`} className="hp-block-item">
 <TrendingUp className="w-4 h-4 shrink-0 text-[var(--hp-sub)]" />
 <span className="flex-1 min-w-0">
 <span className="block truncate text-[var(--hp-ink)] font-medium">
 {dealTypeLabels[deal.deal_type ?? ''] ?? deal.deal_type}{deal.amount ? ` · ${formatAmount(deal.amount)} ₽` : ''}
 </span>
 <span className="block text-[11.5px] text-[var(--hp-sub)]">Стадия двигается сама: документ и оплата продвигают её</span>
 </span>
 <span className="hp-badge hp-badge-good shrink-0">{dealStageLabels[deal.status ?? ''] ?? deal.status}</span>
 </Link>
 ) : (
 <div className="hp-block-item text-[var(--hp-tertiary)]">
 <TrendingUp className="w-4 h-4 shrink-0" />
 Не привязан к сделке — привяжите в «Редактировать», чтобы стадия сделки двигалась автоматически
 </div>
 )}
 {typeConfig?.requiresBaseContract && (
 <div className="hp-block-row">
 <span className="label">Договор-основание</span>
 <span className="value">
 {baseContract?.id
 ? <Link href={`/contracts/${baseContract.id}`} className="hover:text-[var(--hp-accent)] transition-colors">{baseContract.contract_number ?? `#${baseContract.id.slice(0, 8)}`}</Link>
 : <span className="text-[var(--hp-tertiary)] font-normal">не указан</span>}
 </span>
 </div>
 )}
 </div>

 {contract.notes && (
 <div className="hp-block">
 <div className="hp-block-header">Примечания</div>
 <p className="px-[18px] py-3 text-sm text-[var(--hp-sub)] whitespace-pre-wrap leading-relaxed">{contract.notes}</p>
 </div>
 )}

 <PaymentsSection contractId={id} />
 </div>

 <div className="space-y-4">
 {/* Документ: версии и отправка — только когда файл уже сформирован:
 без вложения письмо бессмысленно, а кнопка-обманка хуже её отсутствия. */}
 {contractVersions && contractVersions.length > 0 && (
 <ContractVersionHistory contractId={id} versions={contractVersions} />
 )}
 {contract.generated_docx_url && (
 <SendByEmailForm
 action={sendContractByEmailAction.bind(null, id)}
 defaultEmail={clientContact?.email ?? null}
 title="Отправить договор клиенту"
 hint="Письмо уйдёт с вложенным DOCX последней версии."
 submitLabel="Отправить договор"
 />
 )}
 </div>
 </div>
 </div>
 )
}
