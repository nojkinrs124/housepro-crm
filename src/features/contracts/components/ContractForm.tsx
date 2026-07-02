'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import { FileText, Building2, User, Home, Briefcase, Link2 } from 'lucide-react'
import Link from 'next/link'
import { PartyContactSelect, type PartyContact, type PartyRepresentative } from '@/features/contacts/components/PartyContactSelect'
import { CONTRACT_TYPES, CONTRACT_TYPE_MAP, type ContractPartyRole } from '../config/contract-types'
import { RentApartmentExtraFields, type RentApartmentExtraData } from './RentApartmentExtraFields'

const statusOptions = [
  { value: 'draft',     label: 'Черновик' },
  { value: 'generated', label: 'Создан' },
  { value: 'signed',    label: 'Подписан' },
  { value: 'completed', label: 'Завершён' },
  { value: 'cancelled', label: 'Отменён' },
]

interface CompanyProfileOption { id: string; name: string; legalForm: string; isDefault: boolean }
interface Property { id: string; title: string; address?: string | null; property_type?: string | null }
interface BaseContractOption { id: string; label: string }

interface ContractFormProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: (prevState: any, formData: FormData) => Promise<{ error?: string }>
  owners: PartyContact[]
  clients: PartyContact[]
  representativesByContact: Record<string, PartyRepresentative[]>
  properties: Property[]
  baseContracts: BaseContractOption[]
  companyProfiles: CompanyProfileOption[]
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
    base_contract_id?: string
    company_profile_id?: string
    amount?: number | null
    deposit?: number | null
    start_date?: string | null
    end_date?: string | null
    notes?: string | null
    status?: string
    contract_type_data?: Partial<RentApartmentExtraData>
  }
}

function fieldsForRole(role: ContractPartyRole) {
  return role === 'owner'
    ? { contactField: 'owner_contact_id', repField: 'owner_representative_id' }
    : { contactField: 'client_contact_id', repField: 'client_representative_id' }
}

export function ContractForm({
  action, owners, clients, representativesByContact, properties, baseContracts, companyProfiles,
  backHref, submitLabel, mode, defaults = {}
}: ContractFormProps) {
  const [state, formAction, isPending] = useActionState(action, { error: undefined })
  const [selectedType, setSelectedType] = useState(defaults.contract_type ?? 'rent_apartment')

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

  const inp = 'w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all'
  const sel = 'w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer'
  const lbl = 'block text-sm font-medium text-foreground mb-1.5'

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-xl px-4 py-3 text-sm">
          {state.error}
        </div>
      )}

      {/* Тип договора */}
      <div className="bg-card border border-border rounded-[20px] p-6 space-y-4">
        <h2 className="font-semibold text-foreground">Тип договора</h2>

        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Между собственником и клиентом</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {directTypes.map(t => (
            <label key={t.value}
              className="flex items-center gap-3 p-3 border border-border rounded-xl cursor-pointer hover:bg-accent transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5 text-sm">
              <input type="radio" name="contract_type" value={t.value}
                checked={selectedType === t.value}
                onChange={() => setSelectedType(t.value)}
                className="accent-primary shrink-0" />
              {t.label}
            </label>
          ))}
        </div>

        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">Агентство — сторона договора</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {agencyTypes.map(t => (
            <label key={t.value}
              className="flex items-center gap-3 p-3 border border-border rounded-xl cursor-pointer hover:bg-accent transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5 text-sm">
              <input type="radio" name="contract_type" value={t.value}
                checked={selectedType === t.value}
                onChange={() => setSelectedType(t.value)}
                className="accent-primary shrink-0" />
              {t.label}
            </label>
          ))}
        </div>
      </div>

      {/* Статус (только для edit) */}
      {mode === 'edit' && (
        <div className="bg-card border border-border rounded-[20px] p-6 space-y-3">
          <h2 className="font-semibold text-foreground">Статус</h2>
          <select name="status" defaultValue={defaults.status ?? 'draft'} className={sel}>
            {statusOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Стороны */}
      <div className="bg-card border border-border rounded-[20px] p-6 space-y-5">
        <h2 className="font-semibold text-foreground">Стороны договора</h2>

        {config.party1Role === 'agency' ? (
          <div className="space-y-1.5">
            <label className={lbl + ' flex items-center gap-2'}>
              <Briefcase className="w-4 h-4 text-violet-600" />
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
              <div className="flex items-center gap-2 p-3 rounded-xl border border-dashed border-destructive/40 bg-destructive/5 text-sm text-destructive">
                Нет ни одного профиля компании.{' '}
                <Link href="/settings/company/new" target="_blank" className="underline font-medium">Создать</Link>
              </div>
            )}
          </div>
        ) : (
          <PartyContactSelect
            key={`party1-${selectedType}`}
            label={config.party1Label}
            icon={<Building2 className="w-4 h-4 text-orange-500" />}
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
            ? <Building2 className="w-4 h-4 text-orange-500" />
            : <User className="w-4 h-4 text-blue-500" />}
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

        {config.requiresBaseContract && (
          <div className="space-y-1.5">
            <label className={lbl + ' flex items-center gap-2'}>
              <Link2 className="w-4 h-4 text-violet-500" />
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
            <Home className="w-4 h-4 text-emerald-500" />
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
              className="h-10 px-3 rounded-xl border border-primary/30 text-primary text-sm font-medium hover:bg-primary/10 transition flex items-center gap-1 whitespace-nowrap">
              <Home className="w-4 h-4" />
              Создать
            </Link>
          </div>
        </div>
      </div>

      {/* Финансы и сроки */}
      <div className="bg-card border border-border rounded-[20px] p-6 space-y-5">
        <h2 className="font-semibold text-foreground">Финансы и сроки</h2>
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

      {/* Поля, специфичные для найма жилого помещения */}
      {selectedType === 'rent_apartment' && (
        <RentApartmentExtraFields defaultValue={defaults.contract_type_data} />
      )}

      {/* Примечания */}
      <div className="bg-card border border-border rounded-[20px] p-6 space-y-3">
        <h2 className="font-semibold text-foreground">Примечания</h2>
        <textarea name="notes" rows={3} placeholder="Дополнительные условия..."
          defaultValue={defaults.notes ?? ''}
          className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={isPending}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all disabled:opacity-60">
          <FileText className="w-4 h-4" />
          {isPending ? 'Сохранение...' : submitLabel}
        </button>
        <Link href={backHref}
          className="px-6 py-2.5 border border-border text-foreground rounded-xl text-sm font-medium hover:bg-accent transition-all">
          Отмена
        </Link>
      </div>
    </form>
  )
}
