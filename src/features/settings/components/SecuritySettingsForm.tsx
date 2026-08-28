'use client'

import { useState, useTransition, useRef } from 'react'
import {
 Lock, LogOut, CheckCircle, AlertCircle, Save,
 Loader2, Eye, EyeOff, ShieldCheck, ShieldAlert,
 Clock, Fingerprint, Key
} from 'lucide-react'
import { changePasswordSecurityAction, signOutAllSessionsAction } from '@/features/settings/actions/security.actions'
import { useRouter } from 'next/navigation'

type Feedback = { type: 'success' | 'error'; message: string } | null

const inputCls = 'w-full h-10 px-4 border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all'
const labelCls = 'text-xs font-medium text-muted-foreground uppercase tracking-wide'

function PasswordStrength({ password }: { password: string }) {
 const checks = [
 { label: 'Минимум 8 символов', ok: password.length >= 8 },
 { label: 'Заглавная буква', ok: /[A-Z]/.test(password) },
 { label: 'Цифра', ok: /[0-9]/.test(password) },
 { label: 'Специальный символ', ok: /[^A-Za-z0-9]/.test(password) },
 ]
 const score = checks.filter(c => c.ok).length

 const colors = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-500']
 const labels = ['Слабый', 'Слабый', 'Средний', 'Сильный']
 const barColor = password ? colors[Math.min(score - 1, 3)] : 'bg-border'
 const barWidth = password ? `${(score / 4) * 100}%` : '0%'

 if (!password) return null

 return (
 <div className="space-y-2 mt-2">
 <div className="flex items-center gap-2">
 <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
 <div
 className={`h-full rounded-full transition-all duration-300 ${barColor}`}
 style={{ width: barWidth }}
 />
 </div>
 <span className="text-xs text-muted-foreground w-16 text-right">{password ? labels[Math.min(score - 1, 3)] : ''}</span>
 </div>
 <div className="grid grid-cols-2 gap-1">
 {checks.map(c => (
 <div key={c.label} className={`flex items-center gap-1.5 text-xs ${c.ok ? 'text-green-600' : 'text-muted-foreground'}`}>
 <div className={`w-1 h-1 rounded-full ${c.ok ? 'bg-green-500' : 'bg-border'}`} />
 {c.label}
 </div>
 ))}
 </div>
 </div>
 )
}

export function SecuritySettingsForm({
 email,
 lastSignIn,
 createdAt,
}: {
 email: string
 lastSignIn: string | null
 createdAt: string | null
}) {
 const router = useRouter()
 const passwordFormRef = useRef<HTMLFormElement>(null)

 const [passwordFeedback, setPasswordFeedback] = useState<Feedback>(null)
 const [logoutFeedback, setLogoutFeedback] = useState<Feedback>(null)
 const [passwordPending, startPasswordTransition] = useTransition()
 const [logoutPending, startLogoutTransition] = useTransition()

 const [showNew, setShowNew] = useState(false)
 const [showConfirm, setShowConfirm] = useState(false)
 const [newPassword, setNewPassword] = useState('')
 const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

 function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
 e.preventDefault()
 const fd = new FormData(e.currentTarget)
 setPasswordFeedback(null)
 startPasswordTransition(async () => {
 const result = await changePasswordSecurityAction(fd)
 if (result.error) {
 setPasswordFeedback({ type: 'error', message: result.error })
 } else {
 setPasswordFeedback({ type: 'success', message: 'Пароль успешно обновлён' })
 setNewPassword('')
 passwordFormRef.current?.reset()
 setTimeout(() => setPasswordFeedback(null), 3000)
 }
 })
 }

 function handleSignOutAll() {
 if (!showLogoutConfirm) {
 setShowLogoutConfirm(true)
 return
 }
 setLogoutFeedback(null)
 startLogoutTransition(async () => {
 const result = await signOutAllSessionsAction()
 if (result.error) {
 setLogoutFeedback({ type: 'error', message: result.error })
 setShowLogoutConfirm(false)
 } else {
 router.push('/login')
 }
 })
 }

 return (
 <div className="space-y-5">

 {/* Account info */}
 <div className="bg-card border border-border p-6 space-y-4">
 <h2 className="font-semibold text-foreground flex items-center gap-2 text-sm">
 <ShieldCheck className="w-4 h-4 text-muted-foreground" />
 Информация об аккаунте
 </h2>

 <div className="grid sm:grid-cols-2 gap-3">
 <div className="flex items-start gap-3 p-3.5 bg-muted/50 border border-border">
 <div className="w-8 h-8 bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
 <Key className="w-4 h-4 text-primary" />
 </div>
 <div>
 <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Email</p>
 <p className="text-sm font-medium text-foreground mt-0.5">{email}</p>
 </div>
 </div>

 <div className="flex items-start gap-3 p-3.5 bg-muted/50 border border-border">
 <div className="w-8 h-8 bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
 <Clock className="w-4 h-4 text-blue-600" />
 </div>
 <div>
 <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Последний вход</p>
 <p className="text-sm font-medium text-foreground mt-0.5">{lastSignIn ?? 'Нет данных'}</p>
 </div>
 </div>

 <div className="flex items-start gap-3 p-3.5 bg-muted/50 border border-border sm:col-span-2">
 <div className="w-8 h-8 bg-green-50 flex items-center justify-center shrink-0 mt-0.5">
 <ShieldCheck className="w-4 h-4 text-green-600" />
 </div>
 <div>
 <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Дата регистрации</p>
 <p className="text-sm font-medium text-foreground mt-0.5">{createdAt ?? 'Нет данных'}</p>
 </div>
 </div>
 </div>
 </div>

 {/* Change password */}
 <div className="bg-card border border-border p-6 space-y-4">
 <h2 className="font-semibold text-foreground flex items-center gap-2 text-sm">
 <Lock className="w-4 h-4 text-muted-foreground" />
 Смена пароля
 </h2>

 <form ref={passwordFormRef} onSubmit={handlePasswordSubmit} className="space-y-4">
 <div className="space-y-1.5">
 <label className={labelCls}>Новый пароль</label>
 <div className="relative">
 <input
 name="new_password"
 type={showNew ? 'text' : 'password'}
 required
 minLength={8}
 placeholder="Минимум 8 символов"
 value={newPassword}
 onChange={e => setNewPassword(e.target.value)}
 className={inputCls + ' pr-10'}
 />
 <button
 type="button"
 onClick={() => setShowNew(v => !v)}
 className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
 >
 {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
 </button>
 </div>
 <PasswordStrength password={newPassword} />
 </div>

 <div className="space-y-1.5">
 <label className={labelCls}>Повтор пароля</label>
 <div className="relative">
 <input
 name="confirm_password"
 type={showConfirm ? 'text' : 'password'}
 required
 placeholder="Повторите пароль"
 className={inputCls + ' pr-10'}
 />
 <button
 type="button"
 onClick={() => setShowConfirm(v => !v)}
 className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
 >
 {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
 </button>
 </div>
 </div>

 <div className="flex items-center justify-between pt-1">
 {passwordFeedback ? (
 <div className={`flex items-center gap-2 text-sm ${passwordFeedback.type === 'success' ? 'text-green-600' : 'text-destructive'}`}>
 {passwordFeedback.type === 'success'
 ? <CheckCircle className="w-4 h-4" />
 : <AlertCircle className="w-4 h-4" />
 }
 {passwordFeedback.message}
 </div>
 ) : (
 <span />
 )}

 <button
 type="submit"
 disabled={passwordPending}
 className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-all"
 >
 {passwordPending
 ? <><Loader2 className="w-4 h-4 animate-spin" /> Обновление...</>
 : <><Save className="w-4 h-4" /> Обновить пароль</>
 }
 </button>
 </div>
 </form>
 </div>

 {/* 2FA — info block */}
 <div className="bg-card border border-border p-6 space-y-3">
 <h2 className="font-semibold text-foreground flex items-center gap-2 text-sm">
 <Fingerprint className="w-4 h-4 text-muted-foreground" />
 Двухфакторная аутентификация
 </h2>
 <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200">
 <ShieldAlert className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
 <div>
 <p className="text-sm font-medium text-yellow-900">Не настроена</p>
 <p className="text-sm text-yellow-700 mt-0.5">
 Двухфакторная аутентификация повышает безопасность аккаунта. Функция будет доступна в следующем обновлении.
 </p>
 </div>
 </div>
 </div>

 {/* Sessions / sign out all */}
 <div className="bg-card border border-border p-6 space-y-4">
 <h2 className="font-semibold text-foreground flex items-center gap-2 text-sm">
 <LogOut className="w-4 h-4 text-muted-foreground" />
 Активные сессии
 </h2>

 <div className="flex items-start gap-3 p-3.5 bg-green-50 border border-green-200">
 <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0 animate-pulse" />
 <div>
 <p className="text-sm font-medium text-green-900">Текущая сессия</p>
 <p className="text-xs text-green-700 mt-0.5">Активна сейчас · Браузер</p>
 </div>
 </div>

 {logoutFeedback?.type === 'error' && (
 <div className="flex items-center gap-2 text-sm text-destructive">
 <AlertCircle className="w-4 h-4" />
 {logoutFeedback.message}
 </div>
 )}

 <div className="flex items-center gap-3 pt-1">
 {showLogoutConfirm ? (
 <>
 <span className="text-sm text-muted-foreground">Вы уверены? Будете разлогинены.</span>
 <button
 type="button"
 onClick={() => setShowLogoutConfirm(false)}
 className="px-4 py-2 border border-border text-sm text-foreground hover:bg-accent transition-all"
 >
 Отмена
 </button>
 <button
 type="button"
 onClick={handleSignOutAll}
 disabled={logoutPending}
 className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-60 transition-all"
 >
 {logoutPending
 ? <><Loader2 className="w-4 h-4 animate-spin" /> Выход...</>
 : <><LogOut className="w-4 h-4" /> Подтвердить выход</>
 }
 </button>
 </>
 ) : (
 <button
 type="button"
 onClick={handleSignOutAll}
 className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-all"
 >
 <LogOut className="w-4 h-4" />
 Выйти со всех устройств
 </button>
 )}
 </div>
 </div>
 </div>
 )
}
