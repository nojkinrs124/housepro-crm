import { PhoneDuplicateField } from '@/features/contacts/components/PhoneDuplicateField'
import { Field, FieldGrid, FormExtra, FormSection } from '@/components/forms/FormLayout'
import { LEAD_SOURCES_MANUAL } from '@/features/leads/config/lead-sources'

/**
 * Общее тело формы лида для /leads/new и /leads/[id]/edit — раньше две копии
 * с тремя собственными справочниками (источники, типы сделки и объекта).
 *
 * Лид — это входящий звонок или сообщение. В момент звонка известно
 * немногое: имя, телефон, откуда пришёл и что ищет. Именно это на виду;
 * бюджет, район, площадь, мессенджеры и следующий контакт — в «Дополнительно».
 *
 * Серверный компонент: PhoneDuplicateField (клиентский) рендерится как JSX.
 */

const DEAL_TYPES = [
  { value: 'rent',    label: 'Снять' },
  { value: 'sale',    label: 'Купить' },
  { value: 'subrent', label: 'Субаренда' },
] as const

const PROPERTY_TYPES = [
  { value: 'apartment',  label: 'Квартира' },
  { value: 'house',      label: 'Дом' },
  { value: 'commercial', label: 'Коммерция' },
  { value: 'office',     label: 'Офис' },
  { value: 'land',       label: 'Участок' },
] as const

export interface LeadDefaults {
  full_name?: string | null
  phone?: string | null
  email?: string | null
  telegram?: string | null
  whatsapp?: string | null
  source?: string | null
  assigned_to?: string | null
  next_contact_at?: string | null
  deal_type?: string | null
  property_type?: string | null
  budget_min?: number | null
  budget_max?: number | null
  rooms?: number | null
  district?: string | null
  area_min?: number | null
  area_max?: number | null
  comment?: string | null
}

const radioCls =
  'flex items-center gap-2 px-3 py-2 rounded-[var(--hp-radius)] border border-[var(--hp-border)] cursor-pointer text-sm text-[var(--hp-ink)] transition-colors hover:border-[var(--hp-sub)] has-[:checked]:border-[var(--hp-accent)] has-[:checked]:bg-[var(--hp-accent-tint)]'

export function LeadFormBody({
  lead,
  users,
}: {
  lead?: LeadDefaults
  users: { id: string; full_name: string | null }[]
}) {
  const l = lead ?? {}
  const num = (v: number | null | undefined) => (v == null ? '' : String(v))
  const onlyOneUser = users.length <= 1

  return (
    <>
      <FormSection title="Кто обратился">
        <FieldGrid>
          <Field label="Имя">
            <input name="full_name" defaultValue={l.full_name ?? ''} placeholder="Иван Иванов" className="hp-input" data-testid="lead-full-name" />
          </Field>
          <Field label="Телефон" hint="Если такой номер уже есть в базе — система предупредит">
            <PhoneDuplicateField defaultValue={l.phone ?? ''} placeholder="+7 (999) 999-99-99" className="hp-input" />
          </Field>
          <Field label="Откуда пришёл" required>
            <select name="source" required defaultValue={l.source ?? ''} className="hp-input cursor-pointer" data-testid="lead-source">
              <option value="">Выберите источник</option>
              {LEAD_SOURCES_MANUAL.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          {!onlyOneUser && (
            <Field label="Ответственный">
              <select name="assigned_to" defaultValue={l.assigned_to ?? ''} className="hp-input cursor-pointer">
                <option value="">Себе</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </Field>
          )}
        </FieldGrid>
      </FormSection>

      <FormSection title="Что ищет">
        <FieldGrid>
          <Field label="Хочет">
            <div className="flex flex-wrap gap-2">
              {DEAL_TYPES.map(t => (
                <label key={t.value} className={radioCls}>
                  <input type="radio" name="deal_type" value={t.value} defaultChecked={l.deal_type === t.value} className="w-4 h-4 shrink-0" style={{ accentColor: 'var(--hp-accent)' }} />
                  {t.label}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Тип объекта">
            <div className="flex flex-wrap gap-2">
              {PROPERTY_TYPES.map(t => (
                <label key={t.value} className={radioCls}>
                  <input type="radio" name="property_type" value={t.value} defaultChecked={l.property_type === t.value} className="w-4 h-4 shrink-0" style={{ accentColor: 'var(--hp-accent)' }} />
                  {t.label}
                </label>
              ))}
            </div>
          </Field>
        </FieldGrid>
        <Field label="Комментарий" hint="Что сказал клиент своими словами — пригодится при следующем звонке">
          <textarea name="comment" rows={3} defaultValue={l.comment ?? ''} placeholder="Ищет двушку рядом с метро, въезд с 1 числа…" className="hp-input !h-auto py-2.5 resize-none" data-testid="lead-comment" />
        </Field>
      </FormSection>

      <FormExtra summary="бюджет, комнаты, район, площадь, email и мессенджеры, следующий контакт">
        <FieldGrid>
          <Field label="Бюджет от, ₽">
            <input name="budget_min" type="number" min="0" defaultValue={num(l.budget_min)} placeholder="30 000" className="hp-input" />
          </Field>
          <Field label="Бюджет до, ₽">
            <input name="budget_max" type="number" min="0" defaultValue={num(l.budget_max)} placeholder="80 000" className="hp-input" />
          </Field>
          <Field label="Комнат">
            <select name="rooms" defaultValue={num(l.rooms)} className="hp-input cursor-pointer">
              <option value="">— любое —</option>
              {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n === 4 ? '4+' : n}</option>)}
            </select>
          </Field>
          <Field label="Район">
            <input name="district" defaultValue={l.district ?? ''} placeholder="Центр, Кировский р-н…" className="hp-input" />
          </Field>
          <Field label="Площадь от, м²">
            <input name="area_min" type="number" min="0" defaultValue={num(l.area_min)} placeholder="40" className="hp-input" />
          </Field>
          <Field label="Площадь до, м²">
            <input name="area_max" type="number" min="0" defaultValue={num(l.area_max)} placeholder="80" className="hp-input" />
          </Field>
          <Field label="Email">
            <input name="email" type="email" defaultValue={l.email ?? ''} placeholder="ivan@mail.ru" className="hp-input" />
          </Field>
          <Field label="Telegram">
            <input name="telegram" defaultValue={l.telegram ?? ''} placeholder="@username" className="hp-input" />
          </Field>
          <Field label="WhatsApp">
            <input name="whatsapp" defaultValue={l.whatsapp ?? ''} placeholder="+7 (999) 999-99-99" className="hp-input" />
          </Field>
          <Field label="Следующий контакт" hint="Когда перезвонить — попадёт в задачи на дашборде">
            <input name="next_contact_at" type="datetime-local" defaultValue={l.next_contact_at ? l.next_contact_at.slice(0, 16) : ''} className="hp-input min-w-0" />
          </Field>
        </FieldGrid>
      </FormExtra>
    </>
  )
}
