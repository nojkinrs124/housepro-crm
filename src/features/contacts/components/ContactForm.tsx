'use client'

import { useState, useActionState, useTransition } from 'react'
import Link from 'next/link'
import { AlertCircle, User, Building2 } from 'lucide-react'
import { DadataSuggestInput } from '@/components/forms/DadataSuggestInput'
import { findContactByPhoneAction } from '../actions/duplicates.actions'

const inputCls = "w-full h-10 px-4 rounded-[var(--hp-radius)] border border-[var(--hp-border)] bg-[var(--hp-surface)] text-[var(--hp-ink)] placeholder:text-[var(--hp-tertiary)] text-sm outline-none focus:border-[var(--hp-ink)] transition-colors"
const selectCls = "w-full h-10 px-4 rounded-[var(--hp-radius)] border border-[var(--hp-border)] bg-[var(--hp-surface)] text-[var(--hp-ink)] text-sm outline-none focus:border-[var(--hp-ink)] cursor-pointer transition-colors"
const labelCls = "hp-label"
const cardCls = "bg-[var(--hp-surface)] border border-[var(--hp-border)] rounded-[var(--hp-radius)] p-6 space-y-4"

interface ContactFormDefaults {
  /** Заполнен при редактировании — нужен, чтобы не считать саму карточку дублем. */
  id?: string
  full_name?: string
  role?: string
  status?: string
  birth_date?: string | null
  phone?: string | null
  email?: string | null
  telegram?: string | null
  whatsapp?: string | null
  client_type?: string
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
      {/* Тип лица */}
      <div className={cardCls}>
        <h2 className="font-semibold text-[var(--hp-ink)]">Тип контакта</h2>
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
      </div>

      {/* Основное */}
      <div className={cardCls}>
        <h2 className="font-semibold text-[var(--hp-ink)]">Основные данные</h2>
        <div>
          <label className={labelCls}>{clientType === 'legal_entity' ? 'Контактное лицо (ФИО) *' : 'Полное имя *'}</label>
          <input type="text" name="full_name" required defaultValue={defaults.full_name ?? ''}
            placeholder={clientType === 'legal_entity' ? 'Иванов Иван Иванович' : 'Иван Иванович Иванов'}
            className={inputCls} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Роль *</label>
            <select name="role" required defaultValue={defaults.role ?? 'client'} className={selectCls}>
              <option value="client">Клиент</option>
              <option value="owner">Собственник</option>
              <option value="both">Клиент + Собственник</option>
            </select>
          </div>
          {defaults.status !== undefined && (
            <div>
              <label className={labelCls}>Статус</label>
              <select name="status" defaultValue={defaults.status ?? 'new'} className={selectCls}>
                <option value="new">Новый</option>
                <option value="active">Активный</option>
                <option value="vip">VIP</option>
                <option value="inactive">Неактивный</option>
              </select>
            </div>
          )}
        </div>
        {clientType === 'individual' && (
          <div>
            <label className={labelCls}>Дата рождения</label>
            <input type="date" name="birth_date" defaultValue={defaults.birth_date?.slice(0, 10) ?? ''} className={inputCls} />
          </div>
        )}
      </div>

      {/* Контакты */}
      <div className={cardCls}>
        <h2 className="font-semibold text-[var(--hp-ink)]">Контактные данные</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Телефон</label>
            <input
              type="tel"
              name="phone"
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
              <p className="text-xs text-[var(--hp-warn)] mt-1">
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
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" name="email" defaultValue={defaults.email ?? ''} placeholder="user@example.com" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Telegram</label>
            <input type="text" name="telegram" defaultValue={defaults.telegram ?? ''} placeholder="@username" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>WhatsApp</label>
            <input type="text" name="whatsapp" defaultValue={defaults.whatsapp ?? ''} placeholder="+7 (999) 123-45-67" className={inputCls} />
          </div>
        </div>
      </div>

      {clientType === 'individual' ? (
        <>
          {/* Паспорт */}
          <div className={cardCls}>
            <h2 className="font-semibold text-[var(--hp-ink)]">Паспортные данные</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Серия</label>
                <input type="text" name="passport_series" defaultValue={defaults.passport_series ?? ''} placeholder="1234" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Номер</label>
                <input type="text" name="passport_number" defaultValue={defaults.passport_number ?? ''} placeholder="567890" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Дата выдачи</label>
                <input type="date" name="passport_issued_date" defaultValue={defaults.passport_issued_date?.slice(0, 10) ?? ''} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Код подразделения</label>
                <input type="text" name="passport_department_code" defaultValue={defaults.passport_department_code ?? ''} placeholder="770-001" className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Кем выдан</label>
              <input type="text" name="passport_issued_by" defaultValue={defaults.passport_issued_by ?? ''} placeholder="ОВД Пресненского района г. Москвы" className={inputCls} />
            </div>
          </div>

          {/* Адрес */}
          <div className={cardCls}>
            <h2 className="font-semibold text-[var(--hp-ink)]">Адрес регистрации</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: 'Страна', name: 'country', placeholder: 'Россия', val: defaults.country ?? 'Россия' },
                { label: 'Регион', name: 'region', placeholder: 'Московская область', val: defaults.region },
                { label: 'Город', name: 'city', placeholder: 'Москва', val: defaults.city },
                { label: 'Улица', name: 'street', placeholder: 'ул. Ленина', val: defaults.street },
                { label: 'Дом', name: 'house_number', placeholder: '15', val: defaults.house_number },
                { label: 'Корпус', name: 'building', placeholder: '1', val: defaults.building },
                { label: 'Квартира', name: 'apartment', placeholder: '42', val: defaults.apartment },
              ].map(f => (
                <div key={f.name}>
                  <label className={labelCls}>{f.label}</label>
                  <input type="text" name={f.name} defaultValue={f.val ?? ''} placeholder={f.placeholder} className={inputCls} />
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        /* Реквизиты юрлица */
        <div className={cardCls}>
          <h2 className="font-semibold text-[var(--hp-ink)]">Реквизиты организации</h2>
          <div>
            <label className={labelCls}>Название организации *</label>
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
              renderHint={(s) =>
                s.managerName ? `Руководитель по ЕГРЮЛ: ${s.managerName}${s.managerPost ? `, ${s.managerPost}` : ''}` : null
              }
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>ИНН *</label>
              <input type="text" name="inn" defaultValue={defaults.inn ?? ''} placeholder="7707083893" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>КПП</label>
              <input type="text" name="kpp" defaultValue={defaults.kpp ?? ''} placeholder="770701001" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>ОГРН</label>
              <input type="text" name="ogrn" defaultValue={defaults.ogrn ?? ''} placeholder="1027700132195" className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Юридический адрес</label>
            <input type="text" name="legal_address" defaultValue={defaults.legal_address ?? ''} placeholder="г. Москва, ул. Тверская, д. 1" className={inputCls} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Банк</label>
              {/* По названию банка или БИК подставляются БИК и корр. счёт. */}
              <DadataSuggestInput
                name="bank_name"
                kind="bank"
                defaultValue={defaults.bank_name ?? ''}
                placeholder="Сбербанк или БИК"
                className={inputCls}
                fillFields={{ bik: 'bik', correspondentAccount: 'corr_account' }}
              />
            </div>
            <div>
              <label className={labelCls}>БИК</label>
              <input type="text" name="bik" defaultValue={defaults.bik ?? ''} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Расчётный счёт</label>
              <input type="text" name="bank_account" defaultValue={defaults.bank_account ?? ''} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Корр. счёт</label>
              <input type="text" name="corr_account" defaultValue={defaults.corr_account ?? ''} className={inputCls} />
            </div>
          </div>
          <p className="text-xs text-[var(--hp-sub)]">
            Поле «Контактное лицо» выше — это сотрудник, через которого вы общаетесь. Уполномоченных подписантов (с указанием доверенности) можно будет добавить на странице контакта после создания.
          </p>
        </div>
      )}

      {/* Дополнительно */}
      <div className={cardCls}>
        <h2 className="font-semibold text-[var(--hp-ink)]">Дополнительно</h2>
        <div>
          <label className={labelCls}>Источник</label>
          <select name="source" defaultValue={defaults.source ?? ''} className={selectCls}>
            <option value="">Выберите источник</option>
            <option value="avito">Avito</option>
            <option value="cian">ЦИАН</option>
            <option value="domclick">Домклик</option>
            <option value="instagram">Instagram</option>
            <option value="vk">VK</option>
            <option value="telegram">Telegram</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="phone">Звонок</option>
            <option value="referral">Рекомендация</option>
            <option value="other">Другое</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Комментарий</label>
          <textarea name="comment" rows={3} defaultValue={defaults.comment ?? ''}
            placeholder="Дополнительная информация о контакте..."
            className="w-full px-4 py-2.5 rounded-[var(--hp-radius)] border border-[var(--hp-border)] bg-[var(--hp-surface)] text-[var(--hp-ink)] placeholder:text-[var(--hp-tertiary)] text-sm outline-none focus:border-[var(--hp-ink)] transition-colors resize-none" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={isPending}
          className="px-6 py-2.5 rounded-[var(--hp-radius)] text-white font-semibold transition-colors text-sm bg-[var(--hp-accent)] hover:bg-[var(--hp-accent-hover)] disabled:opacity-60 disabled:cursor-not-allowed">
          {isPending ? 'Сохранение…' : submitLabel}
        </button>
        <Link href={backHref} className="px-6 py-2.5 border border-[var(--hp-border)] text-[var(--hp-ink)] rounded-[var(--hp-radius)] text-sm font-semibold hover:border-[var(--hp-sub)] transition-colors">
          Отмена
        </Link>
      </div>
    </form>
  )
}
