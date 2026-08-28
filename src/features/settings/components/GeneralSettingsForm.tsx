'use client'

import { useState, useTransition, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { Globe, DollarSign, Clock, Calendar, Moon, Sun, Monitor, CheckCircle, AlertCircle, Save, Loader2 } from 'lucide-react'
import { updateGeneralSettingsAction, type GeneralSettings } from '@/features/settings/actions/general.actions'

const LANGUAGES = [
 { value: 'ru', label: 'Русский' },
 { value: 'en', label: 'English' },
]

const CURRENCIES = [
 { value: 'RUB', label: '₽ Российский рубль' },
 { value: 'USD', label: '$ Доллар США' },
 { value: 'EUR', label: '€ Евро' },
 { value: 'KZT', label: '₸ Казахстанский тенге' },
 { value: 'BYN', label: 'Br Белорусский рубль' },
 { value: 'UAH', label: '₴ Украинская гривна' },
]

const TIMEZONES = [
 { value: 'Europe/Moscow', label: 'Москва (UTC+3)' },
 { value: 'Europe/Kaliningrad', label: 'Калининград (UTC+2)' },
 { value: 'Europe/Samara', label: 'Самара (UTC+4)' },
 { value: 'Asia/Yekaterinburg', label: 'Екатеринбург (UTC+5)' },
 { value: 'Asia/Omsk', label: 'Омск (UTC+6)' },
 { value: 'Asia/Krasnoyarsk', label: 'Красноярск (UTC+7)' },
 { value: 'Asia/Irkutsk', label: 'Иркутск (UTC+8)' },
 { value: 'Asia/Yakutsk', label: 'Якутск (UTC+9)' },
 { value: 'Asia/Vladivostok', label: 'Владивосток (UTC+10)' },
 { value: 'Asia/Magadan', label: 'Магадан (UTC+11)' },
 { value: 'Asia/Kamchatka', label: 'Камчатка (UTC+12)' },
 { value: 'Europe/Minsk', label: 'Минск (UTC+3)' },
 { value: 'Asia/Almaty', label: 'Алматы (UTC+5)' },
 { value: 'Europe/Kiev', label: 'Киев (UTC+2/3)' },
]

const DATE_FORMATS = [
 { value: 'DD.MM.YYYY', label: 'ДД.ММ.ГГГГ — 31.12.2025' },
 { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY — 12/31/2025' },
 { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD — 2025-12-31' },
]

const THEMES = [
 { value: 'light', label: 'Светлая', icon: Sun },
 { value: 'dark', label: 'Тёмная', icon: Moon },
 { value: 'system', label: 'Системная', icon: Monitor },
]

type Feedback = { type: 'success' | 'error'; message: string } | null

const inputCls = 'w-full h-10 px-4 border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all'
const labelCls = 'text-xs font-medium text-muted-foreground uppercase tracking-wide'

export function GeneralSettingsForm({ settings }: { settings: GeneralSettings }) {
 const [feedback, setFeedback] = useState<Feedback>(null)
 const [pending, startTransition] = useTransition()
 const [theme, setTheme] = useState(settings.theme)
 const { setTheme: applyTheme } = useTheme()

 // Применяем сохранённую тему пользователя при первой загрузке страницы настроек
 useEffect(() => {
 applyTheme(settings.theme)
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [])

 function handleThemeClick(value: string) {
 setTheme(value)
 applyTheme(value)
 }

 function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
 e.preventDefault()
 const fd = new FormData(e.currentTarget)
 // Override theme from state (radio buttons might not serialize predictably)
 fd.set('theme', theme)
 setFeedback(null)
 startTransition(async () => {
 const result = await updateGeneralSettingsAction(fd)
 if (result.error) {
 setFeedback({ type: 'error', message: result.error })
 } else {
 setFeedback({ type: 'success', message: 'Настройки сохранены' })
 setTimeout(() => setFeedback(null), 3000)
 }
 })
 }

 return (
 <form onSubmit={handleSubmit} className="space-y-5">

 {/* Language + Currency */}
 <div className="bg-card border border-border p-6 space-y-4">
 <h2 className="font-semibold text-foreground flex items-center gap-2 text-sm">
 <Globe className="w-4 h-4 text-muted-foreground" />
 Язык и регион
 </h2>

 <div className="grid sm:grid-cols-2 gap-4">
 <div className="space-y-1.5">
 <label className={labelCls}>Язык интерфейса</label>
 <select name="language" defaultValue={settings.language} className={inputCls}>
 {LANGUAGES.map(l => (
 <option key={l.value} value={l.value}>{l.label}</option>
 ))}
 </select>
 </div>

 <div className="space-y-1.5">
 <label className={labelCls}>Валюта</label>
 <select name="currency" defaultValue={settings.currency} className={inputCls}>
 {CURRENCIES.map(c => (
 <option key={c.value} value={c.value}>{c.label}</option>
 ))}
 </select>
 </div>
 </div>
 </div>

 {/* Timezone + Date format */}
 <div className="bg-card border border-border p-6 space-y-4">
 <h2 className="font-semibold text-foreground flex items-center gap-2 text-sm">
 <Clock className="w-4 h-4 text-muted-foreground" />
 Дата и время
 </h2>

 <div className="grid sm:grid-cols-2 gap-4">
 <div className="space-y-1.5">
 <label className={labelCls}>Часовой пояс</label>
 <select name="timezone" defaultValue={settings.timezone} className={inputCls}>
 {TIMEZONES.map(tz => (
 <option key={tz.value} value={tz.value}>{tz.label}</option>
 ))}
 </select>
 </div>

 <div className="space-y-1.5">
 <label className={labelCls}>Формат даты</label>
 <select name="date_format" defaultValue={settings.date_format} className={inputCls}>
 {DATE_FORMATS.map(f => (
 <option key={f.value} value={f.value}>{f.label}</option>
 ))}
 </select>
 </div>
 </div>
 </div>

 {/* Theme */}
 <div className="bg-card border border-border p-6 space-y-4">
 <h2 className="font-semibold text-foreground flex items-center gap-2 text-sm">
 <Moon className="w-4 h-4 text-muted-foreground" />
 Тема оформления
 </h2>

 <div className="grid grid-cols-3 gap-3">
 {THEMES.map(t => (
 <button
 key={t.value}
 type="button"
 onClick={() => handleThemeClick(t.value)}
 className={`flex flex-col items-center gap-2 p-4 border-2 transition-all ${
 theme === t.value
 ? 'border-primary bg-primary/5'
 : 'border-border hover:border-primary/40 hover:bg-accent/50'
 }`}
 >
 <t.icon className={`w-6 h-6 ${theme === t.value ? 'text-primary' : 'text-muted-foreground'}`} />
 <span className={`text-sm font-medium ${theme === t.value ? 'text-primary' : 'text-foreground'}`}>
 {t.label}
 </span>
 {theme === t.value && (
 <span className="w-1.5 h-1.5 rounded-full bg-primary" />
 )}
 </button>
 ))}
 </div>
 <p className="text-xs text-muted-foreground">Тема применяется сразу и сохраняется в вашем профиле</p>
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
 className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-all"
 >
 {pending
 ? <><Loader2 className="w-4 h-4 animate-spin" /> Сохранение...</>
 : <><Save className="w-4 h-4" /> Сохранить настройки</>
 }
 </button>
 </div>
 </form>
 )
}
