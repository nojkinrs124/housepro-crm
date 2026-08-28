'use client'

import { useState, useTransition, useRef } from 'react'
import { useActionState } from 'react'
import {
 Building2, FileText, Globe, Landmark, Upload,
 Trash2, Save, Loader2, CheckCircle, AlertCircle, Camera, X, UserSquare2, Star
} from 'lucide-react'
import { uploadLogoAction, removeLogoAction } from '@/features/settings/actions/company.actions'
import { LEGAL_FORM_OPTIONS, getLegalFormOption, type LegalForm } from '@/features/settings/config/legal-forms'

export type CompanyProfile = {
 id?: string
 legal_form?: LegalForm | string | null
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
 signatory_name?: string | null
 signatory_position?: string | null
 signatory_basis?: string | null
 passport_series?: string | null
 passport_number?: string | null
 passport_issued_date?: string | null
 passport_issued_by?: string | null
 passport_department_code?: string | null
 logo_url?: string | null
 is_default?: boolean | null
}

type Feedback = { type: 'success' | 'error'; message: string } | null

const inputCls =
 'w-full h-10 px-4 border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all'
const labelCls = 'text-xs font-medium text-muted-foreground uppercase tracking-wide'

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
 return (
 <h2 className="font-semibold text-foreground flex items-center gap-2 text-sm">
 <Icon className="w-4 h-4 text-muted-foreground" />
 {title}
 </h2>
 )
}

interface CompanyProfileFormProps {
 mode: 'create' | 'edit'
 profile: CompanyProfile | null
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 action: (prevState: any, formData: FormData) => Promise<{ error?: string } | void>
 isFirstProfile?: boolean
}

export function CompanyProfileForm({ mode, profile, action, isFirstProfile }: CompanyProfileFormProps) {
 const [state, formAction, isPending] = useActionState(action, { error: undefined })
 const [legalForm, setLegalForm] = useState<string>(profile?.legal_form ?? 'ip')
 const formConfig = getLegalFormOption(legalForm)

 const [logoFeedback, setLogoFeedback] = useState<Feedback>(null)
 const [logoPending, startLogoTransition] = useTransition()
 const [logoSrc, setLogoSrc] = useState(profile?.logo_url ?? '')
 const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)
 const logoInputRef = useRef<HTMLInputElement>(null)

 function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
 const file = e.target.files?.[0]
 if (!file || !profile?.id) return

 const preview = URL.createObjectURL(file)
 setLogoSrc(preview)
 setLogoFeedback(null)
 setShowRemoveConfirm(false)

 const fd = new FormData()
 fd.append('logo', file)
 startLogoTransition(async () => {
 const result = await uploadLogoAction(profile.id!, fd)
 if (result.error) {
 setLogoSrc(profile?.logo_url ?? '')
 setLogoFeedback({ type: 'error', message: result.error })
 } else if (result.url) {
 setLogoSrc(result.url)
 setLogoFeedback({ type: 'success', message: 'Логотип обновлён' })
 setTimeout(() => setLogoFeedback(null), 2500)
 }
 })
 }

 function handleRemoveLogo() {
 if (!profile?.id) return
 if (!showRemoveConfirm) {
 setShowRemoveConfirm(true)
 return
 }
 setLogoFeedback(null)
 startLogoTransition(async () => {
 const result = await removeLogoAction(profile.id!)
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

 return (
 <form action={formAction} className="space-y-5">
 {state?.error && (
 <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 text-sm">
 {state.error}
 </div>
 )}

 {/* Форма собственности */}
 <div className="bg-card border border-border p-6 space-y-4">
 <SectionHeader icon={UserSquare2} title="От чьего имени готовятся документы" />
 <div className="grid grid-cols-3 gap-2.5">
 {LEGAL_FORM_OPTIONS.map(o => (
 <label key={o.value}
 className="flex flex-col items-center gap-1.5 p-3 border border-border cursor-pointer hover:bg-accent transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5 text-sm text-center">
 <input type="radio" name="legal_form" value={o.value}
 checked={legalForm === o.value}
 onChange={() => setLegalForm(o.value)}
 className="accent-primary" />
 <span>{o.icon} {o.label}</span>
 </label>
 ))}
 </div>

 {mode === 'create' && !isFirstProfile && (
 <label className="flex items-center gap-2 text-sm text-foreground pt-1">
 <input type="checkbox" name="is_default" className="accent-primary w-4 h-4" />
 Сделать профилем по умолчанию
 </label>
 )}
 </div>

 {/* Основная информация */}
 <div className="bg-card border border-border p-6 space-y-4">
 <SectionHeader icon={Building2} title="Основная информация" />

 <div className="space-y-1.5">
 <label className={labelCls}>{formConfig.nameLabel} *</label>
 <input name="name" defaultValue={profile?.name ?? ''} placeholder={formConfig.namePlaceholder}
 required className={inputCls} />
 </div>

 {legalForm === 'ooo' && (
 <div className="space-y-1.5">
 <label className={labelCls}>Описание</label>
 <textarea name="description" defaultValue={profile?.description ?? ''}
 placeholder="Агентство недвижимости — продажа и аренда жилой и коммерческой недвижимости"
 rows={2}
 className="w-full px-4 py-2.5 border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none" />
 </div>
 )}

 <div className="grid sm:grid-cols-2 gap-4">
 <div className="space-y-1.5">
 <label className={labelCls}>Телефон</label>
 <input name="phone" type="tel" defaultValue={profile?.phone ?? ''} placeholder="+7 (999) 000-00-00" className={inputCls} />
 </div>
 <div className="space-y-1.5">
 <label className={labelCls}>Email</label>
 <input name="email" type="email" defaultValue={profile?.email ?? ''} placeholder="info@company.ru" className={inputCls} />
 </div>
 </div>

 {legalForm === 'ooo' && (
 <div className="space-y-1.5">
 <label className={labelCls}>Сайт</label>
 <div className="relative">
 <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
 <input name="website" type="url" defaultValue={profile?.website ?? ''} placeholder="https://housepro.ru" className={inputCls + ' pl-9'} />
 </div>
 </div>
 )}

 <div className="space-y-1.5">
 <label className={labelCls}>{legalForm === 'individual' ? 'Адрес регистрации' : 'Юридический адрес'}</label>
 <input name="address" defaultValue={profile?.address ?? ''} placeholder="г. Москва, ул. Примерная, д. 1, оф. 101" className={inputCls} />
 </div>
 </div>

 {/* Юридические реквизиты */}
 <div className="bg-card border border-border p-6 space-y-4">
 <SectionHeader icon={FileText} title={legalForm === 'individual' ? 'Документы физ. лица' : 'Юридические реквизиты'} />

 {legalForm === 'individual' ? (
 <>
 <div className="grid sm:grid-cols-2 gap-4">
 <div className="space-y-1.5">
 <label className={labelCls}>Серия паспорта</label>
 <input name="passport_series" defaultValue={profile?.passport_series ?? ''} placeholder="4509" maxLength={4} className={inputCls} />
 </div>
 <div className="space-y-1.5">
 <label className={labelCls}>Номер паспорта</label>
 <input name="passport_number" defaultValue={profile?.passport_number ?? ''} placeholder="123456" maxLength={6} className={inputCls} />
 </div>
 </div>
 <div className="space-y-1.5">
 <label className={labelCls}>Кем выдан</label>
 <input name="passport_issued_by" defaultValue={profile?.passport_issued_by ?? ''} placeholder="ОВД района Тверской г. Москвы" className={inputCls} />
 </div>
 <div className="grid sm:grid-cols-2 gap-4">
 <div className="space-y-1.5">
 <label className={labelCls}>Дата выдачи</label>
 <input name="passport_issued_date" type="date"
 defaultValue={profile?.passport_issued_date ? profile.passport_issued_date.slice(0, 10) : ''} className={inputCls} />
 </div>
 <div className="space-y-1.5">
 <label className={labelCls}>Код подразделения</label>
 <input name="passport_department_code" defaultValue={profile?.passport_department_code ?? ''} placeholder="770-001" maxLength={7} className={inputCls} />
 </div>
 </div>
 <div className="space-y-1.5">
 <label className={labelCls}>ИНН (если есть)</label>
 <input name="inn" defaultValue={profile?.inn ?? ''} placeholder="771234567890" maxLength={12} className={inputCls} />
 </div>
 </>
 ) : (
 <>
 <div className="grid sm:grid-cols-2 gap-4">
 <div className="space-y-1.5">
 <label className={labelCls}>ИНН</label>
 <input name="inn" defaultValue={profile?.inn ?? ''} placeholder="7701234567" maxLength={12} className={inputCls} />
 </div>
 {legalForm === 'ooo' && (
 <div className="space-y-1.5">
 <label className={labelCls}>КПП</label>
 <input name="kpp" defaultValue={profile?.kpp ?? ''} placeholder="770101001" maxLength={9} className={inputCls} />
 </div>
 )}
 </div>
 <div className="space-y-1.5">
 <label className={labelCls}>{legalForm === 'ip' ? 'ОГРНИП' : 'ОГРН'}</label>
 <input name="ogrn" defaultValue={profile?.ogrn ?? ''} placeholder="1234567890123" maxLength={15} className={inputCls} />
 </div>

 {legalForm === 'ip' && (
 <div className="space-y-1.5">
 <label className={labelCls}>Действует на основании</label>
 <input name="signatory_basis" defaultValue={profile?.signatory_basis ?? ''}
 placeholder="Свидетельства о государственной регистрации ИП" className={inputCls} />
 </div>
 )}

 {legalForm === 'ooo' && (
 <div className="grid sm:grid-cols-2 gap-4">
 <div className="space-y-1.5">
 <label className={labelCls}>ФИО подписанта</label>
 <input name="signatory_name" defaultValue={profile?.signatory_name ?? ''} placeholder="Иванов Иван Иванович" className={inputCls} />
 </div>
 <div className="space-y-1.5">
 <label className={labelCls}>Должность</label>
 <input name="signatory_position" defaultValue={profile?.signatory_position ?? ''} placeholder="Генеральный директор" className={inputCls} />
 </div>
 </div>
 )}
 {legalForm === 'ooo' && (
 <div className="space-y-1.5">
 <label className={labelCls}>Основание полномочий</label>
 <input name="signatory_basis" defaultValue={profile?.signatory_basis ?? ''} placeholder="Устава" className={inputCls} />
 </div>
 )}
 </>
 )}
 </div>

 {/* Банковские реквизиты */}
 <div className="bg-card border border-border p-6 space-y-4">
 <SectionHeader icon={Landmark} title="Банковские реквизиты" />
 <div className="space-y-1.5">
 <label className={labelCls}>Банк</label>
 <input name="bank_name" defaultValue={profile?.bank_name ?? ''} placeholder="ПАО Сбербанк" className={inputCls} />
 </div>
 <div className="grid sm:grid-cols-2 gap-4">
 <div className="space-y-1.5">
 <label className={labelCls}>БИК</label>
 <input name="bik" defaultValue={profile?.bik ?? ''} placeholder="044525225" maxLength={9} className={inputCls} />
 </div>
 <div className="space-y-1.5">
 <label className={labelCls}>{legalForm === 'individual' ? 'Номер счёта' : 'Расчётный счёт'}</label>
 <input name="bank_account" defaultValue={profile?.bank_account ?? ''} placeholder="40702810938000123456" maxLength={20} className={inputCls} />
 </div>
 </div>
 {legalForm !== 'individual' && (
 <div className="space-y-1.5">
 <label className={labelCls}>Корреспондентский счёт</label>
 <input name="corr_account" defaultValue={profile?.corr_account ?? ''} placeholder="30101810400000000225" maxLength={20} className={inputCls} />
 </div>
 )}
 </div>

 {/* Логотип — доступен только после первого сохранения */}
 {mode === 'edit' && profile?.id && (
 <div className="bg-card border border-border p-6 space-y-4">
 <SectionHeader icon={Camera} title="Логотип" />
 <div className="flex items-center gap-5">
 <div className="relative shrink-0">
 <div className="w-20 h-20 border-2 border-dashed border-border bg-muted/30 flex items-center justify-center overflow-hidden">
 {logoSrc ? (
 // eslint-disable-next-line @next/next/no-img-element
 <img src={logoSrc} alt="logo" className="w-full h-full object-contain p-1" />
 ) : (
 <Building2 className="w-8 h-8 text-muted-foreground/40" />
 )}
 </div>
 {logoPending && (
 <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
 <Loader2 className="w-5 h-5 animate-spin text-primary" />
 </div>
 )}
 </div>
 <div className="space-y-2 flex-1">
 <p className="text-sm text-muted-foreground">PNG, JPG, WEBP или SVG. Максимум 2 МБ.</p>
 <div className="flex items-center gap-2 flex-wrap">
 <button type="button" onClick={() => logoInputRef.current?.click()} disabled={logoPending}
 className="flex items-center gap-2 px-4 py-2 border border-border text-sm text-foreground hover:bg-accent transition-all disabled:opacity-60">
 <Upload className="w-4 h-4" />
 Загрузить
 </button>
 {logoSrc && (
 showRemoveConfirm ? (
 <>
 <span className="text-xs text-muted-foreground">Удалить?</span>
 <button type="button" onClick={() => setShowRemoveConfirm(false)}
 className="flex items-center gap-1 px-3 py-2 border border-border text-sm text-foreground hover:bg-accent transition-all">
 <X className="w-3.5 h-3.5" />
 Отмена
 </button>
 <button type="button" onClick={handleRemoveLogo} disabled={logoPending}
 className="flex items-center gap-1.5 px-3 py-2 bg-red-500 text-white text-sm hover:bg-red-600 transition-all disabled:opacity-60">
 <Trash2 className="w-3.5 h-3.5" />
 Удалить
 </button>
 </>
 ) : (
 <button type="button" onClick={handleRemoveLogo} disabled={logoPending}
 className="flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-600 text-sm hover:bg-red-50 transition-all disabled:opacity-60">
 <Trash2 className="w-3.5 h-3.5" />
 Удалить
 </button>
 )
 )}
 </div>
 {logoFeedback && (
 <div className={`flex items-center gap-1.5 text-xs ${logoFeedback.type === 'success' ? 'text-green-600' : 'text-destructive'}`}>
 {logoFeedback.type === 'success' ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
 {logoFeedback.message}
 </div>
 )}
 </div>
 <input ref={logoInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" className="hidden" onChange={handleLogoChange} />
 </div>
 </div>
 )}

 <div className="flex items-center gap-3">
 <button type="submit" disabled={isPending}
 className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all disabled:opacity-60">
 {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
 {isPending ? 'Сохранение...' : mode === 'create' ? 'Создать профиль' : 'Сохранить'}
 </button>
 {profile?.is_default && (
 <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full">
 <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
 Профиль по умолчанию
 </span>
 )}
 </div>
 </form>
 )
}
