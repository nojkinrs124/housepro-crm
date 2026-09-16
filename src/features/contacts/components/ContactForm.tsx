'use client'

import { useState, useActionState, useTransition } from 'react'
import Link from 'next/link'
import { AlertCircle, User, Building2 } from 'lucide-react'
import { DadataSuggestInput } from '@/components/forms/DadataSuggestInput'
import { findContactByPhoneAction } from '../actions/duplicates.actions'
import { CONTACT_SOURCES } from '../config/contact-sources'
import { Field, FieldGrid, FormExtra, FormSection } from '@/components/forms/FormLayout'

const inputCls = "w-full h-10 px-4 rounded-[var(--hp-radius)] border border-[var(--hp-border)] bg-[var(--hp-surface)] text-[var(--hp-ink)] placeholder:text-[var(--hp-tertiary)] text-sm outline-none focus:border-[var(--hp-ink)] transition-colors"
const selectCls = "w-full h-10 px-4 rounded-[var(--hp-radius)] border border-[var(--hp-border)] bg-[var(--hp-surface)] text-[var(--hp-ink)] text-sm outline-none focus:border-[var(--hp-ink)] cursor-pointer transition-colors"
const labelCls = "hp-label"

interface ContactFormDefaults {
  /** Заполнен при редактировании — нужен, чтобы не считать саму карточку дублем. */
  id?: string
  full_name?: string | null
  role?: string | null
  status?: string | null
  birth_date?: string | null
  phone?: string | null
  email?: string | null
  telegram?: string | null
  whatsapp?: string | null
  client_type?: string | null
  passport_series?: string | null
  passport_number?: string | null
  passport_issued_date?: string | null
  passport_issued_by?: string | null
  passport_department_code?: string | null
  country?: string | null
  region?: string | null
  city?: string | null
  street?: string | null
  house_number?: string | null
  building?: string | null
  apartment?: string | null
  company_name?: string | null
  inn?: string | null
  kpp?: string | null
  ogrn?: string | null
  legal_address?: string | null
  bank_name?: string | null
  bank_account?: string | null
  corr_account?: string | null
  bik?: string | null
  source?: string | null
  comment?: string | null
}

type ActionState = { error?: string; fields?: Record<string, string[] | undefined> } | null

interface ContactFormProps {
  action: (prevState: ActionState, formData: FormData) => ActionState | Promise<ActionState>
  defaults?: ContactFormDefaults
  backHref: string
  submitLabel: string
}

export function ContactForm({ action, defaults = {}, backHref, submitLabel }: ContactFormProps) {
  const [clientType, setClientType] = useState(defaults.client_type ?? 'individual')
  const [state, formAction, isPending] = useActionState(action, null)
  // Предупреждение о дубле: проверяем телефон, когда пользователь уходит с поля.
  // Именно так дубли и заводятся — тот же клиент звонит второй раз, и его
  // создают заново, не проверив базу.
  const [phoneMatches, setPhoneMatches] = useState<{ id: string; full_name: string | null }[]>([])
  const [, startPhoneCheck] = useTransition()

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="flex items-center gap-2 rounded-[var(--hp-radius)] border border-[var(--hp-danger-tint)] bg-[var(--hp-danger-tint)] px-4 py-3 text-sm text-[var(--hp-danger)]">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {state.error}
        </div>
      )}

      {/* Кто это: тип, имя, роль (+ организация у юрлица) — правило «≤ 6 полей на виду» */}
      <FormSection title="Кто это">
        <div className="grid grid-cols-2 gap-2.5">
          <label
            className="flex items-center gap-3 p-3 rounded-[var(--hp-radius)] cursor-pointer transition-colors text-sm border"
            style={{ borderColor: clientType === 'individual' ? 'var(--hp-ink)' : 'var(--hp-border)', background: clientType === 'individual' ? 'var(--hp-neutral-tint)' : 'transparent' }}
          >
            <input type="radio" name="client_type" value="individual"
              checked={clientType === 'individual'}
              onChange={() => setClientType('individual')}
              className="shrink-0" />
            <User className="w-4 h-4 text-[var(--hp-sub)] shrink-0" />
            Физическое лицо
          </label>
          <label
            className="flex items-center gap-3 p-3 rounded-[var(--hp-radius)] cursor-pointer transition-colors text-sm border"
            style={{ borderColor: clientType === 'legal_entity' ? 'var(--hp-ink)' : 'var(--hp-border)', background: clientType === 'legal_entity' ? 'var(--hp-neutral-tint)' : 'transparent' }}
          >
            <input type="radio" name="client_type" value="legal_entity"
              checked={clientType === 'legal_entity'}
              onChange={() => setClientType('legal_entity')}
              className="shrink-0" />
            <Building2 className="w-4 h-4 text-[var(--hp-sub)] shrink-0" />
            Юридическое лицо
          </label>
        </div>

        {clientType === 'legal_entity' && (
          <FieldGrid>
          <Field label="Название организации" required hint="Начните вводить название или ИНН — реквизиты подставятся из ЕГРЮЛ">
            {/* Подсказки DaData: по названию или ИНН заполняются КПП, ОГРН, юр. адрес
                и руководитель — раньше всё это вбивалось руками из выписки, а опечатка
                в реквизитах всплывала уже в подписанном договоре. */}
            <DadataSuggestInput
              name="company_name"
              kind="party"
              defaultValue={defaults.company_name ?? ''}
              placeholder='ООО "Ромашка" или ИНН'
              className={inputCls}
              fillFields={{
                inn: 'inn',
                kpp: 'kpp',
                ogrn: 'ogrn',
                legalAddress: 'legal_address',
              }}
              hintTemplate="Руководитель по ЕГРЮЛ: {managerName}[, {managerPost}]"
            />
          </Field>
          <Field label="ИНН" required>
            <input type="text" name="inn" required defaultValue={defaults.inn ?? ''} placeholder="7707083893" className={inputCls} />
          </Field>
          </FieldGrid>
        )}

        <FieldGrid>
          <Field
            label={clientType === 'legal_entity' ? 'Контактное лицо (ФИО)' : 'Полное имя'}
            required
            hint={clientType === 'legal_entity' ? 'Сотрудник, через которого вы общаетесь. Подписантов с доверенностью добавите на карточке после создания' : undefined}
          >
            <input type="text" name="full_name" data-testid="contact-full-name" required defaultValue={defaults.full_name ?? ''}
              placeholder={clientType === 'legal_entity' ? 'Иванов Иван Иванович' : 'Иван Иванович Иванов'}
              className={inputCls} />
          </Field>
          <Field label="Роль" required hint="Клиент ищет или снимает, собственник сдаёт или продаёт">
            <select name="role" required defaultValue={defaults.role ?? 'client'} className={selectCls}>
              <option value="client">Клиент</option>
              <option value="owner">Собственник</option>
              <option value="both">Клиент + Собственник</option>
            </select>
          </Field>
        </FieldGrid>
      </FormSection>

      {/* Как связаться */}
      <FormSection title="Как связаться">
        <FieldGrid>
          <div className="space-y-1.5">
            <label className={labelCls}>Телефон</label>
            <input
              type="tel"
              name="phone"
              data-testid="contact-phone"
              defaultValue={defaults.phone ?? ''}
              placeholder="+7 (999) 123-45-67"
              className={inputCls}
              onBlur={(e) => {
                const value = e.target.value
                if (!value.trim()) { setPhoneMatches([]); return }
                startPhoneCheck(async () => {
                  const res = await findContactByPhoneAction(value)
                  setPhoneMatches(res.matches.filter((m) => m.id !== defaults.id))
                })
              }}
            />
            {phoneMatches.length > 0 && (
              <p className="text-xs text-[var(--hp-warn)]">
                Такой телефон уже есть:{' '}
                {phoneMatches.slice(0, 3).map((m, i) => (
                  <span key={m.id}>
                    {i > 0 && ', '}
                    <Link href={`/contacts/${m.id}`} className="underline">
                      {m.full_name || 'без имени'}
                    </Link>
                  </span>
                ))}
                . Проверьте, не дубль ли это.
              </p>
            )}
          </div>
          <Field label="Email">
            <input type="email" name="email" defaultValue={defaults.email ?? ''} placeholder="user@example.com" className={inputCls} />
          </Field>
        </FieldGrid>
      </FormSection>

      {/* Всё, что не нужно в момент звонка, — заполняется позже: перед договором
          (паспорт, адрес, реквизиты) или по ходу работы (статус, источник). */}
      <FormExtra
        summary={clientType === 'legal_entity'
          ? 'реквизиты и банк, статус, мессенджеры, источник, комментарий'
          : 'паспорт, адрес, дата рождения, статус, мессенджеры, источник, комментарий'}
      >
        <FieldGrid>
          {defaults.status !== undefined && (
            <Field label="Статус" hint="VIP и «неактивный» влияют только на сортировку и фильтры">
              <select name="status" defaultValue={defaults.status ?? 'new'} className={selectCls}>
                <option value="new">Новый</option>
                <option value="active">Активный</option>
                <option value="vip">VIP</option>
                <option value="inactive">Неактивный</option>
              </select>
            </Field>
          )}
          {clientType === 'individual' && (
            <Field label="Дата рождения">
              <input type="date" name="birth_date" defaultValue={defaults.birth_date?.slice(0, 10) ?? ''} className={inputCls} />
            </Field>
          )}
          <Field label="Telegram">
            <input type="text" name="telegram" defaultValue={defaults.telegram ?? ''} placeholder="@username" className={inputCls} />
          </Field>
          <Field label="WhatsApp">
            <input type="text" name="whatsapp" defaultValue={defaults.whatsapp ?? ''} placeholder="+7 (999) 123-45-67" className={inputCls} />
          </Field>
        </FieldGrid>

        {clientType === 'individual' ? (
          <>
            <h3 className="hp-label !mb-0 pt-2">Паспорт — нужен для договора</h3>
            <FieldGrid>
              <Field label="Серия">
                <input type="text" name="passport_series" defaultValue={defaults.passport_series ?? ''} placeholder="1234" className={inputCls} />
              </Field>
              <Field label="Номер">
                <input type="text" name="passport_number" defaultValue={defaults.passport_number ?? ''} placeholder="567890" className={inputCls} />
              </Field>
              <Field label="Дата выдачи">
                <input type="date" name="passport_issued_date" defaultValue={defaults.passport_issued_date?.slice(0, 10) ?? ''} className={inputCls} />
              </Field>
              <Field label="Код подразделения">
                <input type="text" name="passport_department_code" defaultValue={defaults.passport_department_code ?? ''} placeholder="770-001" className={inputCls} />
              </Field>
            </FieldGrid>
            <Field label="Кем выдан">
              <input type="text" name="passport_issued_by" defaultValue={defaults.passport_issued_by ?? ''} placeholder="ОВД Пресненского района г. Москвы" className={inputCls} />
            </Field>

            <h3 className="hp-label !mb-0 pt-2">Адрес регистрации</h3>
            <FieldGrid>
              {[
                { label: 'Страна', name: 'country', placeholder: 'Россия', val: defaults.country ?? 'Россия' },
                { label: 'Регион', name: 'region', placeholder: 'Московская область', val: defaults.region },
                { label: 'Город', name: 'city', placeholder: 'Москва', val: defaults.city },
                { label: 'Улица', name: 'street', placeholder: 'ул. Ленина', val: defaults.street },
                { label: 'Дом', name: 'house_number', placeholder: '15', val: defaults.house_number },
                { label: 'Корпус', name: 'building', placeholder: '1', val: defaults.building },
                { label: 'Квартира', name: 'apartment', placeholder: '42', val: defaults.apartment },
              ].map(f => (
                <Field key={f.name} label={f.label}>
                  <input type="text" name={f.name} defaultValue={f.val ?? ''} placeholder={f.placeholder} className={inputCls} />
                </Field>
              ))}
            </FieldGrid>
          </>
        ) : (
          <>
            <h3 className="hp-label !mb-0 pt-2">Реквизиты — нужны для договора</h3>
            <FieldGrid>
              <Field label="КПП">
                <input type="text" name="kpp" defaultValue={defaults.kpp ?? ''} placeholder="770701001" className={inputCls} />
              </Field>
              <Field label="ОГРН">
                <input type="text" name="ogrn" defaultValue={defaults.ogrn ?? ''} placeholder="1027700132195" className={inputCls} />
              </Field>
              <Field label="Юридический адрес">
                <input type="text" name="legal_address" defaultValue={defaults.legal_address ?? ''} placeholder="г. Москва, ул. Тверская, д. 1" className={inputCls} />
              </Field>
              <Field label="Банк" hint="По названию или БИК подставятся БИК и корр. счёт">
                <DadataSuggestInput
                  name="bank_name"
                  kind="bank"
                  defaultValue={defaults.bank_name ?? ''}
                  placeholder="Сбербанк или БИК"
                  className={inputCls}
                  fillFields={{ bik: 'bik', correspondentAccount: 'corr_account' }}
                />
              </Field>
              <Field label="БИК">
                <input type="text" name="bik" defaultValue={defaults.bik ?? ''} className={inputCls} />
              </Field>
              <Field label="Расчётный счёт">
                <input type="text" name="bank_account" defaultValue={defaults.bank_account ?? ''} className={inputCls} />
              </Field>
              <Field label="Корр. счёт">
                <input type="text" name="corr_account" defaultValue={defaults.corr_account ?? ''} className={inputCls} />
              </Field>
            </FieldGrid>
          </>
        )}

        <FieldGrid>
          <Field label="Источник" hint="Как узнали о контакте">
            <select name="source" defaultValue={defaults.source ?? ''} className={selectCls}>
              <option value="">Выберите источник</option>
              {CONTACT_SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
        </FieldGrid>
        <Field label="Комментарий">
          <textarea name="comment" rows={3} defaultValue={defaults.comment ?? ''}
            placeholder="Что важно помнить об этом человеке…"
            className={`${inputCls} !h-auto py-2.5 resize-none`} />
        </Field>
      </FormExtra>

      <div className="flex items-center gap-3 pt-1">
        <button type="submit" data-testid="contact-submit" disabled={isPending} className="hp-btn-primary disabled:opacity-60 disabled:cursor-not-allowed">
          {isPending ? 'Сохранение…' : submitLabel}
        </button>
        <Link href={backHref} className="hp-btn-secondary">Отмена</Link>
      </div>
    </form>
  )
}
