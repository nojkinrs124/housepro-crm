'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import { FileText, Building2, User, Home, Briefcase, Link2 } from 'lucide-react'
import Link from 'next/link'
import { PartyContactSelect, type PartyContact, type PartyRepresentative } from '@/features/contacts/components/PartyContactSelect'
import { CONTRACT_TYPES, CONTRACT_TYPE_MAP, type ContractPartyRole } from '../config/contract-types'
import { RentApartmentExtraFields } from './RentApartmentExtraFields'
import { CommercialRentExtraFields } from './CommercialRentExtraFields'
import { SaleExtraFields } from './SaleExtraFields'
import { AgencyServiceExtraFields } from './AgencyServiceExtraFields'
import { PropertyManagementExtraFields } from './PropertyManagementExtraFields'
import { SETTLEMENT_SCHEMES, getChargeType } from '@/features/plans/config/settlement'
import { SubleaseExtraFields } from './SubleaseExtraFields'

const AGENCY_SERVICE_TYPES = ['agency_owner', 'agency_client', 'agency_legal_entity']

const statusOptions = [
 { value: 'draft', label: 'Черновик' },
 { value: 'generated', label: 'Создан' },
 { value: 'signed', label: 'Подписан' },
 { value: 'completed', label: 'Завершён' },
 { value: 'cancelled', label: 'Отменён' },
]

interface CompanyProfileOption { id: string; name: string; legalForm: string; isDefault: boolean }
interface Property { id: string; title: string; address?: string | null; property_type?: string | null }
interface BaseContractOption { id: string; label: string }
interface DealOption { id: string; label: string }

interface ContractFormProps {
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 action: (prevState: any, formData: FormData) => Promise<{ error?: string }>
 owners: PartyContact[]
 clients: PartyContact[]
 representativesByContact: Record<string, PartyRepresentative[]>
 properties: Property[]
 baseContracts: BaseContractOption[]
 companyProfiles: CompanyProfileOption[]
 deals?: DealOption[]
 plans?: PlanOption[]
 backHref: string
 submitLabel: string
 mode: 'create' | 'edit'
 defaults?: {
 contract_type?: string
 owner_contact_id?: string
 client_contact_id?: string
 owner_representative_id?: string
 client_representative_id?: string
 property_id?: string
 deal_id?: string
 base_contract_id?: string
 company_profile_id?: string
 amount?: number | null
 deposit?: number | null
 start_date?: string | null
 end_date?: string | null
 notes?: string | null
 status?: string
 contract_type_data?: Record<string, unknown> | null
 plan_id?: string | null
 settlement_scheme?: string | null
 owner_fixed_amount?: number | null
 owner_payout_day?: number | null
 }
}

/** Тариф из справочника — форма показывает только активные и подходящие направлению. */
export interface PlanOption {
 id: string
 code: string
 title: string
 chargeType: string
 rate: number | null
 directions: string[]
}

function fieldsForRole(role: ContractPartyRole) {
 return role === 'owner'
 ? { contactField: 'owner_contact_id', repField: 'owner_representative_id' }
 : { contactField: 'client_contact_id', repField: 'client_representative_id' }
}

export function ContractForm({
 action, owners, clients, representativesByContact, properties, baseContracts, companyProfiles, deals = [],
 plans = [], backHref, submitLabel, mode, defaults = {}
}: ContractFormProps) {
 const [state, formAction, isPending] = useActionState(action, { error: undefined })
 const [selectedType, setSelectedType] = useState(defaults.contract_type ?? 'rent_apartment')
 const [scheme, setScheme] = useState(defaults.settlement_scheme ?? 'percent')

 const config = CONTRACT_TYPE_MAP[selectedType] ?? CONTRACT_TYPES[0]
 const directTypes = CONTRACT_TYPES.filter(t => t.group === 'direct')
 const agencyTypes = CONTRACT_TYPES.filter(t => t.group === 'agency')

 const party2Contacts = config.party2Role === 'owner'
 ? owners
 : config.requiresLegalEntity
 ? clients.filter(c => c.client_type === 'legal_entity')
 : clients

 const party1Fields = fieldsForRole(config.party1Role === 'agency' ? 'owner' : config.party1Role)
 const party2Fields = fieldsForRole(config.party2Role)

 const filteredProperties = config.propertyTypes
 ? properties.filter(p => config.propertyTypes!.includes(p.property_type ?? '') || p.id === defaults.property_id)
 : properties

 const inp = 'w-full h-10 px-4 border border-[var(--hp-border)] bg-[var(--hp-surface)] text-[var(--hp-ink)] text-sm outline-none focus:border-[var(--hp-ink)] transition-colors'
 const sel = 'w-full h-10 px-4 border border-[var(--hp-border)] bg-[var(--hp-surface)] text-[var(--hp-ink)] text-sm outline-none focus:border-[var(--hp-ink)] cursor-pointer'
 const lbl = 'block text-sm font-medium text-[var(--hp-ink)] mb-1.5'
 const h2 = 'font-bold text-[var(--hp-ink)] text-[15px]'

 return (
 <form action={formAction} className="space-y-4">
 {state?.error && (
 <div className="bg-[var(--hp-danger-tint)] border border-[var(--hp-danger)] text-[var(--hp-danger)] px-4 py-3 text-sm">
 {state.error}
 </div>
 )}

 {/* Тип договора */}
 <div className="hp-card p-5 space-y-4">
 <h2 className={h2}>Тип договора</h2>

 <div className="space-y-1.5">
 <p className="text-[11px] font-semibold text-[var(--hp-sub)] uppercase tracking-[0.06em]">Между собственником и клиентом</p>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
 {directTypes.map(t => {
 const Icon = t.icon
 return (
 <label key={t.value}
 className="flex items-center gap-3 p-3 border border-[var(--hp-border)] cursor-pointer transition-colors hover:bg-[var(--hp-neutral-tint)] has-[:checked]:border-[var(--hp-accent)] has-[:checked]:bg-[var(--hp-accent-tint)] text-sm">
 <input type="radio" name="contract_type" value={t.value}
 checked={selectedType === t.value}
 onChange={() => setSelectedType(t.value)}
 className="shrink-0" style={{ accentColor: 'var(--hp-accent)' }} />
 <Icon style={{ width: 16, height: 16, color: 'var(--hp-sub)' }} className="shrink-0" />
 <span className="text-[var(--hp-ink)]">{t.label}</span>
 </label>
 )
 })}
 </div>
 </div>

 <div className="space-y-1.5 pt-1">
 <p className="text-[11px] font-semibold text-[var(--hp-sub)] uppercase tracking-[0.06em]">Агентство — сторона договора</p>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
 {agencyTypes.map(t => {
 const Icon = t.icon
 return (
 <label key={t.value}
 className="flex items-center gap-3 p-3 border border-[var(--hp-border)] cursor-pointer transition-colors hover:bg-[var(--hp-neutral-tint)] has-[:checked]:border-[var(--hp-accent)] has-[:checked]:bg-[var(--hp-accent-tint)] text-sm">
 <input type="radio" name="contract_type" value={t.value}
 checked={selectedType === t.value}
 onChange={() => setSelectedType(t.value)}
 className="shrink-0" style={{ accentColor: 'var(--hp-accent)' }} />
 <Icon style={{ width: 16, height: 16, color: 'var(--hp-sub)' }} className="shrink-0" />
 <span className="text-[var(--hp-ink)]">{t.label}</span>
 </label>
 )
 })}
 </div>
 </div>
 </div>

 {/* Статус (только для edit) */}
 {mode === 'edit' && (
 <div className="hp-card p-5 space-y-3">
 <h2 className={h2}>Статус</h2>
 <select name="status" defaultValue={defaults.status ?? 'draft'} className={sel}>
 {statusOptions.map(o => (
 <option key={o.value} value={o.value}>{o.label}</option>
 ))}
 </select>
 </div>
 )}

 {/* Стороны */}
 <div className="hp-card p-5 space-y-5">
 <h2 className={h2}>Стороны договора</h2>

 {config.party1Role === 'agency' ? (
 <div className="space-y-1.5">
 <label className={lbl + ' flex items-center gap-2'}>
 <Briefcase className="w-4 h-4 text-[var(--hp-sub)]" />
 {config.party1Label}
 </label>
 {companyProfiles.length > 0 ? (
 <select name="company_profile_id"
 defaultValue={defaults.company_profile_id || companyProfiles.find(p => p.isDefault)?.id || companyProfiles[0]?.id}
 className={sel}>
 {companyProfiles.map(p => (
 <option key={p.id} value={p.id}>
 {p.name}{p.isDefault ? ' (по умолчанию)' : ''}
 </option>
 ))}
 </select>
 ) : (
 <div className="flex items-center gap-2 p-3 border border-dashed border-[var(--hp-danger)] bg-[var(--hp-danger-tint)] text-sm text-[var(--hp-danger)]">
 Нет ни одного профиля компании.{' '}
 <Link href="/settings/company/new" target="_blank" className="underline font-medium">Создать</Link>
 </div>
 )}
 </div>
 ) : (
 <PartyContactSelect
 key={`party1-${selectedType}`}
 label={config.party1Label}
 icon={<Building2 className="w-4 h-4 text-[var(--hp-warn)]" />}
 contactFieldName={party1Fields.contactField}
 representativeFieldName={party1Fields.repField}
 contacts={owners}
 representativesByContact={representativesByContact}
 defaultContactId={defaults.owner_contact_id ?? ''}
 defaultRepresentativeId={defaults.owner_representative_id ?? ''}
 placeholder="Выберите собственника"
 />
 )}

 <PartyContactSelect
 key={`party2-${selectedType}`}
 label={config.party2Label}
 icon={config.party2Role === 'owner'
 ? <Building2 className="w-4 h-4 text-[var(--hp-warn)]" />
 : <User className="w-4 h-4 text-[var(--hp-info)]" />}
 contactFieldName={party2Fields.contactField}
 representativeFieldName={party2Fields.repField}
 contacts={party2Contacts}
 representativesByContact={representativesByContact}
 defaultContactId={
 party2Fields.contactField === 'owner_contact_id'
 ? defaults.owner_contact_id ?? ''
 : defaults.client_contact_id ?? ''
 }
 defaultRepresentativeId={
 party2Fields.repField === 'owner_representative_id'
 ? defaults.owner_representative_id ?? ''
 : defaults.client_representative_id ?? ''
 }
 placeholder={config.requiresLegalEntity ? 'Выберите юр. лицо' : `Выберите: ${config.party2Label.toLowerCase()}`}
 />

 <div className="space-y-1.5">
 <label className={lbl + ' flex items-center gap-2'}>
 <Link2 className="w-4 h-4 text-[var(--hp-good)]" />
 Сделка (необязательно)
 </label>
 <select name="deal_id" defaultValue={defaults.deal_id ?? ''} className={sel}>
 <option value="">Не связан со сделкой</option>
 {deals.map(d => (
 <option key={d.id} value={d.id}>{d.label}</option>
 ))}
 </select>
 <p className="text-xs text-muted-foreground">
 Если выбрать сделку — она будет сама двигаться по стадиям: создание договора → «Договор»,
 формирование DOCX → «Оплата», отметка платежа оплаченным → «Завершено».
 </p>
 </div>

 {config.requiresBaseContract && (
 <div className="space-y-1.5">
 <label className={lbl + ' flex items-center gap-2'}>
 <Link2 className="w-4 h-4 text-[var(--hp-sub)]" />
 Договор-основание (исходная аренда)
 </label>
 <select name="base_contract_id" defaultValue={defaults.base_contract_id ?? ''} className={sel}>
 <option value="">Не выбрано</option>
 {baseContracts.map(c => (
 <option key={c.id} value={c.id}>{c.label}</option>
 ))}
 </select>
 {baseContracts.length === 0 && (
 <p className="text-xs text-muted-foreground">Нет действующих договоров аренды для основания.</p>
 )}
 </div>
 )}

 <div className="space-y-1.5">
 <label className={lbl + ' flex items-center gap-2'}>
 <Home className="w-4 h-4 text-[var(--hp-good)]" />
 Объект
 </label>
 <div className="flex items-center gap-2">
 <select name="property_id" defaultValue={defaults.property_id ?? ''} className={sel + ' flex-1'}>
 <option value="">Выберите объект</option>
 {filteredProperties.map(p => (
 <option key={p.id} value={p.id}>{p.title}{p.address ? ` — ${p.address}` : ''}</option>
 ))}
 </select>
 <Link href="/properties/new" target="_blank"
 className="h-10 px-3 border border-[var(--hp-accent)] text-[var(--hp-accent)] text-sm font-medium hover:bg-[var(--hp-accent-tint)] transition-colors flex items-center gap-1 whitespace-nowrap">
 <Home className="w-4 h-4" />
 Создать
 </Link>
 </div>
 </div>
 </div>

 {/* Финансы и сроки */}
 <div className="hp-card p-5 space-y-5">
 <h2 className={h2}>Финансы и сроки</h2>
 <div className="grid grid-cols-2 gap-4">
 <div className={`space-y-1.5 ${config.showDeposit ? '' : 'col-span-2'}`}>
 <label className={lbl}>{config.amountLabel}</label>
 <input name="amount" type="number" placeholder={config.amountPlaceholder ?? '50 000'}
 defaultValue={defaults.amount ?? ''} className={inp} />
 </div>
 {config.showDeposit && (
 <div className="space-y-1.5">
 <label className={lbl}>{config.depositLabel}</label>
 <input name="deposit" type="number" placeholder="50 000"
 defaultValue={defaults.deposit ?? ''} className={inp} />
 </div>
 )}
 {config.dateMode === 'single' ? (
 <div className="space-y-1.5 col-span-2">
 <label className={lbl}>{config.startDateLabel}</label>
 <input name="start_date" type="date"
 defaultValue={defaults.start_date ? defaults.start_date.slice(0, 10) : ''} className={inp} />
 </div>
 ) : (
 <>
 <div className="space-y-1.5">
 <label className={lbl}>{config.startDateLabel}</label>
 <input name="start_date" type="date"
 defaultValue={defaults.start_date ? defaults.start_date.slice(0, 10) : ''} className={inp} />
 </div>
 <div className="space-y-1.5">
 <label className={lbl}>{config.endDateLabel}</label>
 <input name="end_date" type="date"
 defaultValue={defaults.end_date ? defaults.end_date.slice(0, 10) : ''} className={inp} />
 </div>
 </>
 )}
 </div>
 </div>

 {/* Тариф агентства — только у договоров, где агентство является стороной
 и получает вознаграждение. У договоров между собственником и клиентом
 напрямую агентство стороной не является, и тариф там не при чём. */}
 {config.direction && (
 <div className="hp-card p-5 space-y-5">
 <h2 className={h2}>Тариф и расчёт</h2>

 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-1.5">
 <label className={lbl}>Тариф</label>
 <select name="plan_id" defaultValue={defaults.plan_id ?? ''} className={sel}>
 <option value="">Не выбран</option>
 {plans
 .filter(p => p.directions.includes(config.direction!))
 .map(p => {
 const charge = getChargeType(p.chargeType)
 const rate = p.rate !== null && charge?.rateUnit ? ` — ${p.rate}${charge.rateUnit}` : ''
 return <option key={p.id} value={p.id}>{p.title}{rate}</option>
 })}
 </select>
 <p className="text-xs text-[var(--hp-sub)]">
 Ставка копируется в договор при сохранении и дальше не меняется, даже если тариф поправят
 </p>
 </div>
 </div>

 {(selectedType === 'property_management' || selectedType === 'sublease') && (
 <div className="space-y-4">
 <div className="space-y-1.5">
 <label className={lbl}>Схема расчёта с собственником</label>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
 {SETTLEMENT_SCHEMES.map(s => (
 <label key={s.value} className="flex items-start gap-2 p-2.5 border border-[var(--hp-border)] cursor-pointer text-sm text-[var(--hp-ink)] transition-colors hover:border-[var(--hp-sub)] has-[:checked]:border-[var(--hp-accent)]">
 <input
 type="radio" name="settlement_scheme" value={s.value}
 checked={scheme === s.value}
 onChange={() => setScheme(s.value)}
 className="mt-0.5 w-4 h-4 shrink-0 accent-[var(--hp-accent)]"
 />
 <span className="min-w-0">
 {s.label}
 <span className="block text-xs text-[var(--hp-sub)]">{s.description}</span>
 <span className="block text-xs text-[var(--hp-warn)] mt-1">
 Риск простоя: {s.vacancyRiskBearer === 'agency' ? 'на агентстве' : 'на собственнике'}
 </span>
 </span>
 </label>
 ))}
 </div>
 </div>

 {scheme === 'fixed' && (
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-1.5">
 <label className={lbl}>Выплата собственнику (₽/мес)</label>
 <input name="owner_fixed_amount" type="number" required
 defaultValue={defaults.owner_fixed_amount ?? ''} placeholder="40 000" className={inp} />
 </div>
 <div className="space-y-1.5">
 <label className={lbl}>День выплаты</label>
 <input name="owner_payout_day" type="number" min="1" max="28" required
 defaultValue={defaults.owner_payout_day ?? 5} className={inp} />
 <p className="text-xs text-[var(--hp-sub)]">
 От 1 до 28: 29-е и позже есть не в каждом месяце
 </p>
 </div>
 </div>
 )}
 </div>
 )}
 </div>
 )}

 {/* Поля, специфичные для выбранного типа договора */}
 {selectedType === 'rent_apartment' && (
 <RentApartmentExtraFields key={selectedType} defaultValue={defaults.contract_type_data} />
 )}
 {selectedType === 'rent_commercial' && (
 <CommercialRentExtraFields key={selectedType} defaultValue={defaults.contract_type_data} />
 )}
 {selectedType === 'sale' && (
 <SaleExtraFields key={selectedType} defaultValue={defaults.contract_type_data} />
 )}
 {AGENCY_SERVICE_TYPES.includes(selectedType) && (
 <AgencyServiceExtraFields key={selectedType} defaultValue={defaults.contract_type_data} />
 )}
 {selectedType === 'property_management' && (
 <PropertyManagementExtraFields key={selectedType} defaultValue={defaults.contract_type_data} />
 )}
 {selectedType === 'sublease' && (
 <SubleaseExtraFields key={selectedType} defaultValue={defaults.contract_type_data} />
 )}

 {/* Примечания */}
 <div className="hp-card p-5 space-y-3">
 <h2 className={h2}>Примечания</h2>
 <textarea name="notes" rows={3} placeholder="Дополнительные условия..."
 defaultValue={defaults.notes ?? ''}
 className="w-full px-4 py-3 border border-[var(--hp-border)] bg-[var(--hp-surface)] text-[var(--hp-ink)] text-sm outline-none focus:border-[var(--hp-ink)] resize-none" />
 </div>

 <div className="flex items-center gap-3">
 <button type="submit" disabled={isPending}
 className="flex items-center gap-2 px-6 py-2.5 bg-[var(--hp-accent)] text-white text-sm font-semibold hover:bg-[var(--hp-accent-hover)] transition-colors disabled:opacity-60">
 <FileText className="w-4 h-4" />
 {isPending ? 'Сохранение...' : submitLabel}
 </button>
 <Link href={backHref}
 className="px-6 py-2.5 border border-[var(--hp-border)] text-[var(--hp-ink)] text-sm font-semibold hover:border-[var(--hp-sub)] transition-colors">
 Отмена
 </Link>
 </div>
 </form>
 )
}
