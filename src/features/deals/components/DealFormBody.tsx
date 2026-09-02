import { Building2, User } from 'lucide-react'
import { PartyContactSelect } from '@/features/contacts/components/PartyContactSelect'
import { PropertySelectField } from '@/features/properties/components/PropertySelectField'
import { DEAL_STAGES, DEAL_STAGE_CANCELLED, DEAL_TYPE_LABELS } from '@/features/deals/config/deal-stages'

/**
 * Общее тело формы сделки для /deals/new и /deals/[id]/edit.
 * Раньше обе страницы держали одинаковую разметку двумя копиями — новые
 * поля («Условия сделки») пришлось бы добавлять дважды и они бы разъехались.
 *
 * Серверный компонент: клиентские PartyContactSelect / PropertySelectField
 * рендерятся как JSX-элементы, функции из них не импортируются.
 */

const inputCls =
  'w-full h-10 px-4 rounded-[var(--hp-radius)] border border-[var(--hp-border)] bg-[var(--hp-surface)] text-[var(--hp-ink)] placeholder:text-[var(--hp-tertiary)] text-sm outline-none focus:border-[var(--hp-ink)] transition-colors'
const dateCls = `${inputCls} min-w-0`

const radioCls =
  'flex items-center gap-2 p-2.5 rounded-[var(--hp-radius)] border border-[var(--hp-border)] cursor-pointer text-sm text-[var(--hp-ink)] transition-colors hover:border-[var(--hp-sub)] has-[:checked]:border-[var(--hp-accent)] has-[:checked]:bg-[var(--hp-accent-tint)]'

const PAYMENT_METHODS = ['Наличные', 'Безналичный расчёт', 'Ипотека', 'Материнский капитал', 'Рассрочка']
const DEAL_SOURCES = [
  { value: 'referral', label: 'Рекомендация' }, { value: 'avito', label: 'Avito' },
  { value: 'cian', label: 'ЦИАН' }, { value: 'domclick', label: 'Домклик' },
  { value: 'site', label: 'Сайт' }, { value: 'telegram', label: 'Telegram' },
  { value: 'phone', label: 'Звонок' }, { value: 'other', label: 'Другое' },
]

// `| null` вместо `?:` — колонки в базе nullable, страницы отдают ровно то,
// что вернул запрос, без подмены null на undefined.
interface ContactOption { id: string; full_name: string; phone?: string | null; role: string; client_type?: string | null }
interface PropertyOption { id: string; title: string; address?: string | null }

export function DealFormBody({
  deal,
  owners,
  clients,
  properties,
  representativesByContact,
  ownerDefaultId = '',
  clientDefaultId = '',
  ownerRepDefaultId = '',
  clientRepDefaultId = '',
  propertyDefaultId = '',
  showStatus = false,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deal?: any
  owners: ContactOption[]
  clients: ContactOption[]
  properties: PropertyOption[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  representativesByContact: Record<string, any[]>
  ownerDefaultId?: string
  clientDefaultId?: string
  ownerRepDefaultId?: string
  clientRepDefaultId?: string
  propertyDefaultId?: string
  showStatus?: boolean
}) {
  const d = deal ?? {}

  return (
    <>
      {/* Тип сделки */}
      <div className="hp-card p-5 space-y-4">
        <h2 className="hp-h2">Тип сделки</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {Object.entries(DEAL_TYPE_LABELS).map(([value, label]) => (
            <label key={value} className={radioCls}>
              <input
                type="radio" name="deal_type" value={value}
                defaultChecked={d.deal_type ? d.deal_type === value : value === 'rent'}
                className="w-4 h-4 shrink-0 accent-[var(--hp-accent)]"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* Этап — только при редактировании */}
      {showStatus && (
        <div className="hp-card p-5 space-y-4">
          <h2 className="hp-h2">Этап</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[...DEAL_STAGES, DEAL_STAGE_CANCELLED].map(s => (
              <label key={s.value} className={radioCls}>
                <input
                  type="radio" name="status" value={s.value}
                  defaultChecked={d.status === s.value}
                  className="w-4 h-4 shrink-0 accent-[var(--hp-accent)]"
                />
                {s.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Стороны */}
      <div className="hp-card p-5 space-y-5">
        <h2 className="hp-h2">Стороны сделки</h2>

        <PartyContactSelect
          label="Собственник (Сторона 1)"
          icon={<Building2 className="w-4 h-4 text-[var(--hp-sub)]" />}
          contactFieldName="owner_contact_id"
          representativeFieldName="owner_representative_id"
          contacts={owners}
          representativesByContact={representativesByContact}
          defaultContactId={ownerDefaultId}
          defaultRepresentativeId={ownerRepDefaultId}
          placeholder="Выберите собственника"
          quickCreateRole="owner"
        />

        <PartyContactSelect
          label="Клиент (Сторона 2)"
          icon={<User className="w-4 h-4 text-[var(--hp-sub)]" />}
          contactFieldName="client_contact_id"
          representativeFieldName="client_representative_id"
          contacts={clients}
          representativesByContact={representativesByContact}
          defaultContactId={clientDefaultId}
          defaultRepresentativeId={clientRepDefaultId}
          placeholder="Выберите клиента"
          quickCreateRole="client"
        />

        <PropertySelectField properties={properties} defaultPropertyId={propertyDefaultId} />
      </div>

      {/* Финансы */}
      <div className="hp-card p-5 space-y-4">
        <h2 className="hp-h2">Финансы</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="hp-label">Сумма сделки, ₽</label>
            <input name="amount" type="number" min="0" defaultValue={d.amount ?? ''} placeholder="38 500 000" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className="hp-label">Комиссия агентства, ₽</label>
            <input name="commission" type="number" min="0" defaultValue={d.commission ?? ''} placeholder="1 155 000" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className="hp-label">Аванс / задаток, ₽</label>
            <input name="advance_amount" type="number" min="0" defaultValue={d.advance_amount ?? ''} placeholder="500 000" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className="hp-label">Первый взнос, ₽</label>
            <input name="down_payment" type="number" min="0" defaultValue={d.down_payment ?? ''} placeholder="8 000 000" className={inputCls} />
          </div>
        </div>
      </div>

      {/* Условия — блок «Объект и условия» на карточке сделки */}
      <div className="hp-card p-5 space-y-4">
        <h2 className="hp-h2">Условия сделки</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="hp-label">Форма оплаты</label>
            <select name="payment_method" defaultValue={d.payment_method ?? ''}
              className={`${inputCls} cursor-pointer`}>
              <option value="">— не выбрано —</option>
              {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="hp-label">Банк</label>
            <input name="bank_name" defaultValue={d.bank_name ?? ''} placeholder="Сбер" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className="hp-label">Одобрение банка получено</label>
            <input name="bank_approval_date" type="date" defaultValue={d.bank_approval_date ?? ''} className={dateCls} />
          </div>
          <div className="space-y-1.5">
            <label className="hp-label">Плановое закрытие</label>
            <input name="expected_close_date" type="date" defaultValue={d.expected_close_date ?? ''} className={dateCls} />
          </div>
          <div className="space-y-1.5">
            <label className="hp-label">Торг, ₽</label>
            <input name="bargain_amount" type="number" min="0" defaultValue={d.bargain_amount ?? ''} placeholder="1 500 000" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className="hp-label">Источник</label>
            <select name="source" defaultValue={d.source ?? ''} className={`${inputCls} cursor-pointer`}>
              <option value="">— не выбрано —</option>
              {DEAL_SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Примечания */}
      <div className="hp-card p-5 space-y-3">
        <h2 className="hp-h2">Примечания</h2>
        <textarea
          name="notes" rows={3} defaultValue={d.notes ?? ''}
          placeholder="Детали сделки, договорённости, что обсуждается…"
          className="w-full px-4 py-2.5 rounded-[var(--hp-radius)] border border-[var(--hp-border)] bg-[var(--hp-surface)] text-[var(--hp-ink)] placeholder:text-[var(--hp-tertiary)] text-sm outline-none focus:border-[var(--hp-ink)] transition-colors resize-none"
        />
      </div>
    </>
  )
}
