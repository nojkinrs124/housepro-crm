'use client'

import { useState, useTransition, useRef } from 'react'
import {
  Building2, FileText, Phone, Globe, Landmark, Upload,
  Trash2, Save, Loader2, CheckCircle, AlertCircle, Camera, X
} from 'lucide-react'
import {
  updateCompanyAction,
  uploadLogoAction,
  removeLogoAction,
} from '@/features/settings/actions/company.actions'

type Company = {
  id?: string
  name?: string | null
  inn?: string | null
  ogrn?: string | null
  kpp?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  description?: string | null
  bank_name?: string | null
  bank_account?: string | null
  bik?: string | null
  corr_account?: string | null
  logo_url?: string | null
}

type Feedback = { type: 'success' | 'error'; message: string } | null

const inputCls =
  'w-full h-10 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all'
const labelCls = 'text-xs font-medium text-muted-foreground uppercase tracking-wide'

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <h2 className="font-semibold text-foreground flex items-center gap-2 text-sm">
      <Icon className="w-4 h-4 text-muted-foreground" />
      {title}
    </h2>
  )
}

export function CompanySettingsForm({ company, isAdmin }: { company: Company | null; isAdmin: boolean }) {
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [logoFeedback, setLogoFeedback] = useState<Feedback>(null)
  const [pending, startTransition] = useTransition()
  const [logoPending, startLogoTransition] = useTransition()
  const [logoSrc, setLogoSrc] = useState(company?.logo_url ?? '')
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setFeedback(null)
    startTransition(async () => {
      const result = await updateCompanyAction(fd)
      if (result.error) {
        setFeedback({ type: 'error', message: result.error })
      } else {
        setFeedback({ type: 'success', message: 'Данные компании сохранены' })
        setTimeout(() => setFeedback(null), 3000)
      }
    })
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const preview = URL.createObjectURL(file)
    setLogoSrc(preview)
    setLogoFeedback(null)
    setShowRemoveConfirm(false)

    const fd = new FormData()
    fd.append('logo', file)
    startLogoTransition(async () => {
      const result = await uploadLogoAction(fd)
      if (result.error) {
        setLogoSrc(company?.logo_url ?? '')
        setLogoFeedback({ type: 'error', message: result.error })
      } else if (result.url) {
        setLogoSrc(result.url)
        setLogoFeedback({ type: 'success', message: 'Логотип обновлён' })
        setTimeout(() => setLogoFeedback(null), 2500)
      }
    })
  }

  function handleRemoveLogo() {
    if (!showRemoveConfirm) {
      setShowRemoveConfirm(true)
      return
    }
    setLogoFeedback(null)
    startLogoTransition(async () => {
      const result = await removeLogoAction()
      if (result.error) {
        setLogoFeedback({ type: 'error', message: result.error })
      } else {
        setLogoSrc('')
        setShowRemoveConfirm(false)
        setLogoFeedback({ type: 'success', message: 'Логотип удалён' })
        setTimeout(() => setLogoFeedback(null), 2500)
      }
    })
  }

  if (!isAdmin) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 text-center">
        <Building2 className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
        <p className="font-semibold text-yellow-900">Только для администраторов</p>
        <p className="text-sm text-yellow-700 mt-1">Управление данными компании доступно только администраторам системы.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Logo */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <SectionHeader icon={Camera} title="Логотип компании" />

        <div className="flex items-center gap-5">
          {/* Logo preview */}
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-border bg-muted/30 flex items-center justify-center overflow-hidden">
              {logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoSrc} alt="logo" className="w-full h-full object-contain p-1" />
              ) : (
                <Building2 className="w-8 h-8 text-muted-foreground/40" />
              )}
            </div>
            {logoPending && (
              <div className="absolute inset-0 rounded-2xl bg-background/70 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            )}
          </div>

          <div className="space-y-2 flex-1">
            <p className="text-sm text-muted-foreground">PNG, JPG, WEBP или SVG. Максимум 2 МБ.</p>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={logoPending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm text-foreground hover:bg-accent transition-all disabled:opacity-60"
              >
                <Upload className="w-4 h-4" />
                Загрузить
              </button>

              {logoSrc && (
                showRemoveConfirm ? (
                  <>
                    <span className="text-xs text-muted-foreground">Удалить?</span>
                    <button
                      type="button"
                      onClick={() => setShowRemoveConfirm(false)}
                      className="flex items-center gap-1 px-3 py-2 rounded-xl border border-border text-sm text-foreground hover:bg-accent transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                      Отмена
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      disabled={logoPending}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500 text-white text-sm hover:bg-red-600 transition-all disabled:opacity-60"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Удалить
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    disabled={logoPending}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 text-red-600 text-sm hover:bg-red-50 transition-all disabled:opacity-60"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Удалить
                  </button>
                )
              )}
            </div>

            {logoFeedback && (
              <div className={`flex items-center gap-1.5 text-xs ${logoFeedback.type === 'success' ? 'text-green-600' : 'text-destructive'}`}>
                {logoFeedback.type === 'success'
                  ? <CheckCircle className="w-3.5 h-3.5" />
                  : <AlertCircle className="w-3.5 h-3.5" />
                }
                {logoFeedback.message}
              </div>
            )}
          </div>

          <input
            ref={logoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/svg+xml"
            className="hidden"
            onChange={handleLogoChange}
          />
        </div>
      </div>

      {/* Basic info */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <SectionHeader icon={Building2} title="Основная информация" />

        <div className="space-y-1.5">
          <label className={labelCls}>Название компании *</label>
          <input
            name="name"
            defaultValue={company?.name ?? ''}
            placeholder="ООО «HousePro»"
            required
            className={inputCls}
          />
        </div>

        <div className="space-y-1.5">
          <label className={labelCls}>Описание</label>
          <textarea
            name="description"
            defaultValue={company?.description ?? ''}
            placeholder="Агентство недвижимости — продажа и аренда жилой и коммерческой недвижимости"
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={labelCls}>Телефон</label>
            <input
              name="phone"
              type="tel"
              defaultValue={company?.phone ?? ''}
              placeholder="+7 (999) 000-00-00"
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Email</label>
            <input
              name="email"
              type="email"
              defaultValue={company?.email ?? ''}
              placeholder="info@company.ru"
              className={inputCls}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className={labelCls}>Сайт</label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              name="website"
              type="url"
              defaultValue={company?.website ?? ''}
              placeholder="https://housepro.ru"
              className={inputCls + ' pl-9'}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className={labelCls}>Юридический адрес</label>
          <input
            name="address"
            defaultValue={company?.address ?? ''}
            placeholder="г. Москва, ул. Примерная, д. 1, оф. 101"
            className={inputCls}
          />
        </div>
      </div>

      {/* Requisites */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <SectionHeader icon={FileText} title="Юридические реквизиты" />

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={labelCls}>ИНН</label>
            <input
              name="inn"
              defaultValue={company?.inn ?? ''}
              placeholder="7701234567"
              maxLength={12}
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>КПП</label>
            <input
              name="kpp"
              defaultValue={company?.kpp ?? ''}
              placeholder="770101001"
              maxLength={9}
              className={inputCls}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className={labelCls}>ОГРН / ОГРНИП</label>
          <input
            name="ogrn"
            defaultValue={company?.ogrn ?? ''}
            placeholder="1234567890123"
            maxLength={15}
            className={inputCls}
          />
        </div>
      </div>

      {/* Bank details */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <SectionHeader icon={Landmark} title="Банковские реквизиты" />

        <div className="space-y-1.5">
          <label className={labelCls}>Банк</label>
          <input
            name="bank_name"
            defaultValue={company?.bank_name ?? ''}
            placeholder="ПАО Сбербанк"
            className={inputCls}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={labelCls}>БИК</label>
            <input
              name="bik"
              defaultValue={company?.bik ?? ''}
              placeholder="044525225"
              maxLength={9}
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Расчётный счёт</label>
            <input
              name="bank_account"
              defaultValue={company?.bank_account ?? ''}
              placeholder="40702810938000123456"
              maxLength={20}
              className={inputCls}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className={labelCls}>Корреспондентский счёт</label>
          <input
            name="corr_account"
            defaultValue={company?.corr_account ?? ''}
            placeholder="30101810400000000225"
            maxLength={20}
            className={inputCls}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        {feedback ? (
          <div className={`flex items-center gap-2 text-sm ${feedback.type === 'success' ? 'text-green-600' : 'text-destructive'}`}>
            {feedback.type === 'success'
              ? <CheckCircle className="w-4 h-4" />
              : <AlertCircle className="w-4 h-4" />
            }
            {feedback.message}
          </div>
        ) : (
          <span />
        )}

        <button
          type="submit"
          disabled={pending}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-all"
        >
          {pending
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Сохранение...</>
            : <><Save className="w-4 h-4" /> Сохранить реквизиты</>
          }
        </button>
      </div>
    </form>
  )
}
