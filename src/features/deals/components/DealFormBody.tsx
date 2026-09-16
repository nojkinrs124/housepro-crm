import { Building2, User } from 'lucide-react'
import { PartyContactSelect } from '@/features/contacts/components/PartyContactSelect'
import { PropertySelectField } from '@/features/properties/components/PropertySelectField'
import { DirectionStagePicker } from '@/features/directions/components/DirectionStagePicker'
import { DEAL_SOURCES } from '@/features/deals/config/deal-sources'
import { Field, FieldGrid, FormExtra, FormSection } from '@/components/forms/FormLayout'

/**
 * Общее тело формы сделки для /deals/new и /deals/[id]/edit.
 * Раньше обе страницы держали одинаковую разметку двумя копиями — новые
 * поля («Условия сделки») пришлось бы добавлять дважды и они бы разъехались.
 *
 * Серверный компонент: клиентские PartyContactSelect / PropertySelectField
 * рендерятся как JSX-элементы, функции из них не импортируются.
 */

const PAYMENT_METHODS = ['Наличные', 'Безналичный расчёт', 'Ипотека', 'Материнский капитал', 'Рассрочка']


// `| null` вместо `?:` — колонки в базе nullable, страницы отдают ровно то,
// что вернул запрос, без подмены null на undefined.
interface ContactOption { id: string; full_name: string; phone?: string | null; role: string; client_type?: string | null }
interface PropertyOption { id: string; title: string; address?: string | null }
export interface RepresentativeOption { id: string; contact_id: string; full_name: string; position?: string | null; is_primary?: boolean | null }

/**
 * Поля сделки, которые форма подставляет в значения по умолчанию. Именно те,
 * что читаются ниже, — не вся строка: остальное форме не нужно, а `any`
 * прятал бы опечатку в имени поля.
 */
interface DealDefaults {
  deal_type?: string | null
  status?: string | null
  amount?: number | null
  commission?: number | null
  advance_amount?: number | null
  down_payment?: number | null
  bargain_amount?: number | null
  expected_close_date?: string | null
  bank_approval_date?: string | null
  bank_name?: string | null
  payment_method?: string | null
  source?: string | null
  notes?: string | null
}

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
  deal?: DealDefaults
  owners: ContactOption[]
  clients: ContactOption[]
  properties: PropertyOption[]
  representativesByContact: Record<string, RepresentativeOption[]>
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
      {/* Направление и стадия — клиентский блок: список стадий зависит от направления */}
      <DirectionStagePicker
        direction={d.deal_type}
        status={d.status}
        showStatus={showStatus}
      />


      {/* Стороны */}
      <FormSection title="Стороны сделки" className="!space-y-5">

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
      </FormSection>

      {/* Финансы — то, что известно при создании сделки */}
      <FormSection title="Финансы">
        <FieldGrid>
          <Field label="Сумма сделки, ₽">
            <input step="any" name="amount" type="number" min="0" defaultValue={d.amount ?? ''} placeholder="38 500 000" className="hp-input" />
          </Field>
          <Field label="Комиссия агентства, ₽">
            <input name="commission" type="number" min="0" defaultValue={d.commission ?? ''} placeholder="1 155 000" className="hp-input" />
          </Field>
        </FieldGrid>
      </FormSection>

      {/* Правило простоты №3: на виду ≤ 6 полей, остальное заполняется позже —
          по ходу сделки, когда появятся аванс, банк и дата закрытия. */}
      <FormExtra summary="аванс, первый взнос, форма оплаты, банк, плановое закрытие, торг, источник, примечания">
        <FieldGrid>
          <Field label="Аванс / задаток, ₽" hint="Сумма, которую клиент вносит при подписании предварительного договора">
            <input step="any" name="advance_amount" type="number" min="0" defaultValue={d.advance_amount ?? ''} placeholder="500 000" className="hp-input" />
          </Field>
          <Field label="Первый взнос, ₽" hint="Собственные средства покупателя при ипотеке — то, что не покрывает банк">
            <input name="down_payment" type="number" min="0" defaultValue={d.down_payment ?? ''} placeholder="8 000 000" className="hp-input" />
          </Field>
          <Field label="Форма оплаты" hint="Как клиент рассчитывается по сделке — не касается комиссии агентства">
            <select name="payment_method" defaultValue={d.payment_method ?? ''} className="hp-input cursor-pointer">
              <option value="">— не выбрано —</option>
              {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Банк">
            <input name="bank_name" defaultValue={d.bank_name ?? ''} placeholder="Сбер" className="hp-input" />
          </Field>
          <Field label="Одобрение банка получено">
            <input name="bank_approval_date" type="date" defaultValue={d.bank_approval_date ?? ''} className="hp-input min-w-0" />
          </Field>
          <Field label="Плановое закрытие">
            <input name="expected_close_date" type="date" defaultValue={d.expected_close_date ?? ''} className="hp-input min-w-0" />
          </Field>
          <Field label="Торг, ₽" hint="На сколько снизили цену от заявленной — для отчётности по сделке">
            <input step="any" name="bargain_amount" type="number" min="0" defaultValue={d.bargain_amount ?? ''} placeholder="1 500 000" className="hp-input" />
          </Field>
          <Field label="Источник" hint="Откуда пришла сделка — по нему считается, какая площадка окупается">
            <select name="source" defaultValue={d.source ?? ''} className="hp-input cursor-pointer">
              <option value="">— не выбрано —</option>
              {DEAL_SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
        </FieldGrid>
        <Field label="Примечания">
          <textarea
            name="notes" data-testid="deal-notes" rows={3} defaultValue={d.notes ?? ''}
            placeholder="Детали сделки, договорённости, что обсуждается…"
            className="hp-input !h-auto py-2.5 resize-none"
          />
        </Field>
      </FormExtra>
    </>
  )
}
