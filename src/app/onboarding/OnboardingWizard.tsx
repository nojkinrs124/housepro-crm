'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Building2, User, Home, UserPlus, FileText, ChevronRight, Loader2 } from 'lucide-react'
import { LEGAL_FORM_OPTIONS } from '@/features/settings/config/legal-forms'

interface Props {
 orgId: string
 orgName: string
 userId: string
 employees: { id: string; full_name: string }[]
}

const STEPS = [
 { id: 1, icon: Building2, label: 'Компания', desc: 'Название и реквизиты' },
 { id: 2, icon: User, label: 'Профиль', desc: 'Юридическая форма' },
 { id: 3, icon: Home, label: 'Первый объект', desc: 'Добавьте объект' },
 { id: 4, icon: UserPlus, label: 'Первый лид', desc: 'Тестовый клиент' },
 { id: 5, icon: FileText, label: 'Шаблоны', desc: 'DOCX шаблоны' },
]

export function OnboardingWizard({ orgId, orgName: initialName, userId, employees }: Props) {
 const router = useRouter()
 const [step, setStep] = useState(1)
 const [loading, setLoading] = useState(false)
 const [error, setError] = useState<string | null>(null)

 // Step 1 state
 const [orgName, setOrgName] = useState(initialName)
 const [orgPhone, setOrgPhone] = useState('')

 // Step 2 state
 const [companyType, setCompanyType] = useState('ip')
 const [companyInn, setCompanyInn] = useState('')

 // Step 3 state
 const [propTitle, setPropTitle] = useState('')
 const [propAddress, setPropAddress] = useState('')
 const [propType, setPropType] = useState('apartment')

 // Step 4 state
 const [leadName, setLeadName] = useState('')
 const [leadPhone, setLeadPhone] = useState('')

 async function handleNext() {
 setError(null)
 setLoading(true)

 try {
 if (step === 1) {
 if (!orgName.trim()) { setError('Введите название компании'); setLoading(false); return }
 const res = await fetch('/api/onboarding/step1', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ orgId, name: orgName, phone: orgPhone }),
 })
 if (!res.ok) { const d = await res.json(); setError(d.error); setLoading(false); return }
 }

 if (step === 2) {
 const res = await fetch('/api/onboarding/step2', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ orgId, legal_form: companyType, inn: companyInn }),
 })
 if (!res.ok) { const d = await res.json(); setError(d.error); setLoading(false); return }
 }

 if (step === 3 && propTitle.trim()) {
 const res = await fetch('/api/onboarding/step3', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ orgId, title: propTitle, address: propAddress, property_type: propType, userId }),
 })
 if (!res.ok) { const d = await res.json(); setError(d.error); setLoading(false); return }
 }

 if (step === 4 && leadName.trim()) {
 const res = await fetch('/api/onboarding/step4', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ orgId, full_name: leadName, phone: leadPhone, userId }),
 })
 if (!res.ok) { const d = await res.json(); setError(d.error); setLoading(false); return }
 }

 if (step === 5) {
 // Mark onboarding complete
 const res = await fetch('/api/onboarding/complete', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ orgId }),
 })
 if (!res.ok) { const d = await res.json(); setError(d.error); setLoading(false); return }
 router.push('/dashboard')
 return
 }

 setStep(s => s + 1)
 } catch {
 setError('Произошла ошибка. Попробуйте ещё раз.')
 } finally {
 setLoading(false)
 }
 }

 const progress = ((step - 1) / (STEPS.length - 1)) * 100

 return (
 <div className="min-h-[80vh] flex items-center justify-center p-4">
 <div className="w-full max-w-lg">
 {/* Header */}
 <div className="text-center mb-8">
 <div className="w-14 h-14 bg-primary/10 flex items-center justify-center mx-auto mb-4">
 <Building2 className="w-7 h-7 text-primary" />
 </div>
 <h1 className="text-2xl font-bold">Добро пожаловать в HousePro!</h1>
 <p className="text-muted-foreground mt-1 text-sm">Давайте настроим вашу систему за 2 минуты</p>
 </div>

 {/* Progress */}
 <div className="flex items-center gap-2 mb-8">
 {STEPS.map((s, i) => {
 const Icon = s.icon
 const done = step > s.id
 const active = step === s.id
 return (
 <div key={s.id} className="flex items-center flex-1">
 <div className={`w-8 h-8 rounded-[var(--hp-radius)] flex items-center justify-center flex-shrink-0 transition-all ${
 done ? 'bg-primary text-white' :
 active ? 'bg-primary/10 border-2 border-primary text-primary' :
 'bg-[var(--hp-neutral-tint)] text-[var(--hp-tertiary)]'
 }`}>
 {done ? <Check className="w-4 h-4" /> : <Icon className="w-3.5 h-3.5" />}
 </div>
 {i < STEPS.length - 1 && (
 <div className={`flex-1 h-0.5 mx-1 transition-all ${step > s.id ? 'bg-primary' : 'bg-[var(--hp-tertiary)]'}`} />
 )}
 </div>
 )
 })}
 </div>

 {/* Card */}
 <div className="hp-card p-6">
 <div className="mb-6">
 <h2 className="text-lg font-semibold">{STEPS[step - 1].label}</h2>
 <p className="text-sm text-muted-foreground">{STEPS[step - 1].desc}</p>
 </div>

 {/* Step 1 */}
 {step === 1 && (
 <div className="space-y-4">
 <div>
 <label className="block text-sm font-medium mb-1.5">Название агентства *</label>
 <input value={orgName} onChange={e => setOrgName(e.target.value)}
 placeholder="Агентство недвижимости «Ваш дом»"
 className="w-full px-3 py-2 text-sm border border-[var(--hp-border)] outline-none focus:border-[var(--hp-ink)]" />
 </div>
 <div>
 <label className="block text-sm font-medium mb-1.5">Телефон</label>
 <input value={orgPhone} onChange={e => setOrgPhone(e.target.value)}
 placeholder="+7 (999) 000-00-00"
 className="w-full px-3 py-2 text-sm border border-[var(--hp-border)] outline-none focus:border-[var(--hp-ink)]" />
 </div>
 </div>
 )}

 {/* Step 2 */}
 {step === 2 && (
 <div className="space-y-4">
 <div>
 <label className="block text-sm font-medium mb-1.5">Форма собственности</label>
 <select value={companyType} onChange={e => setCompanyType(e.target.value)}
 className="w-full px-3 py-2 text-sm border border-[var(--hp-border)] bg-[var(--hp-surface)] outline-none focus:border-[var(--hp-ink)]">
 {LEGAL_FORM_OPTIONS.map(o => (
 <option key={o.value} value={o.value}>{o.label}</option>
 ))}
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium mb-1.5">ИНН</label>
 <input value={companyInn} onChange={e => setCompanyInn(e.target.value)}
 placeholder="1234567890"
 className="w-full px-3 py-2 text-sm border border-[var(--hp-border)] outline-none focus:border-[var(--hp-ink)]" />
 </div>
 </div>
 )}

 {/* Step 3 */}
 {step === 3 && (
 <div className="space-y-4">
 <p className="text-sm text-muted-foreground">Необязательно — можно пропустить</p>
 <div>
 <label className="block text-sm font-medium mb-1.5">Название объекта</label>
 <input value={propTitle} onChange={e => setPropTitle(e.target.value)}
 placeholder="2-комнатная квартира на Пушкина"
 className="w-full px-3 py-2 text-sm border border-[var(--hp-border)] outline-none focus:border-[var(--hp-ink)]" />
 </div>
 <div>
 <label className="block text-sm font-medium mb-1.5">Адрес</label>
 <input value={propAddress} onChange={e => setPropAddress(e.target.value)}
 placeholder="ул. Пушкина, д. 1, кв. 10"
 className="w-full px-3 py-2 text-sm border border-[var(--hp-border)] outline-none focus:border-[var(--hp-ink)]" />
 </div>
 <div>
 <label className="block text-sm font-medium mb-1.5">Тип</label>
 <select value={propType} onChange={e => setPropType(e.target.value)}
 className="w-full px-3 py-2 text-sm border border-[var(--hp-border)] bg-[var(--hp-surface)] outline-none focus:border-[var(--hp-ink)]">
 <option value="apartment">Квартира</option>
 <option value="house">Дом</option>
 <option value="commercial">Коммерция</option>
 <option value="land">Земля</option>
 </select>
 </div>
 </div>
 )}

 {/* Step 4 */}
 {step === 4 && (
 <div className="space-y-4">
 <p className="text-sm text-muted-foreground">Необязательно — можно пропустить</p>
 <div>
 <label className="block text-sm font-medium mb-1.5">Имя клиента</label>
 <input value={leadName} onChange={e => setLeadName(e.target.value)}
 placeholder="Иван Иванов"
 className="w-full px-3 py-2 text-sm border border-[var(--hp-border)] outline-none focus:border-[var(--hp-ink)]" />
 </div>
 <div>
 <label className="block text-sm font-medium mb-1.5">Телефон</label>
 <input value={leadPhone} onChange={e => setLeadPhone(e.target.value)}
 placeholder="+7 (999) 000-00-00"
 className="w-full px-3 py-2 text-sm border border-[var(--hp-border)] outline-none focus:border-[var(--hp-ink)]" />
 </div>
 </div>
 )}

 {/* Step 5 */}
 {step === 5 && (
 <div className="space-y-4">
 <div className="p-4 bg-[var(--hp-neutral-tint)] text-sm text-muted-foreground">
 <p className="font-medium text-foreground mb-2">Шаблоны DOCX договоров</p>
 <p>Загрузите шаблоны для автоматической генерации договоров купли-продажи, аренды и управления.</p>
 <p className="mt-2">Вы сможете добавить их позже в разделе <strong>Настройки → Шаблоны документов</strong>.</p>
 </div>
 <a
 href="/settings/templates"
 target="_blank"
 rel="noopener noreferrer"
 className="flex items-center gap-2 text-sm text-primary font-medium hover:underline"
 >
 <FileText className="w-4 h-4" />
 Перейти к шаблонам
 </a>
 </div>
 )}

 {error && (
 <div className="mt-4 px-3 py-2 bg-[var(--hp-danger-tint)] border border-[var(--hp-border)] text-sm text-[var(--hp-danger)]">
 {error}
 </div>
 )}
 </div>

 {/* Actions */}
 <div className="flex items-center justify-between mt-5">
 <button
 onClick={() => setStep(s => Math.max(1, s - 1))}
 disabled={step === 1 || loading}
 className="px-4 py-2 text-sm text-muted-foreground border border-[var(--hp-border)] hover:bg-[var(--hp-neutral-tint)] transition-colors disabled:opacity-30"
 >
 Назад
 </button>

 <div className="text-xs text-muted-foreground">{step} / {STEPS.length}</div>

 <button
 onClick={handleNext}
 disabled={loading}
 className="flex items-center gap-2 px-5 py-2 bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
 >
 {loading && <Loader2 className="w-4 h-4 animate-spin" />}
 {step === STEPS.length ? 'Завершить' : 'Далее'}
 {!loading && step < STEPS.length && <ChevronRight className="w-4 h-4" />}
 </button>
 </div>
 </div>
 </div>
 )
}
