'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { updatePassword } from '../actions/auth.actions'

export function ResetPasswordForm() {
 const router = useRouter()
 const [password, setPassword] = useState('')
 const [confirm, setConfirm] = useState('')
 const [showPassword, setShowPassword] = useState(false)
 const [error, setError] = useState<string | null>(null)
 const [isPending, startTransition] = useTransition()

 function handleSubmit(e: React.FormEvent) {
 e.preventDefault()
 setError(null)

 if (password.length < 6) {
 setError('Пароль должен быть не короче 6 символов')
 return
 }
 if (password !== confirm) {
 setError('Пароли не совпадают')
 return
 }

 startTransition(async () => {
 const formData = new FormData()
 formData.set('password', password)
 const result = await updatePassword(formData)
 if (result?.error) {
 setError(result.error)
 return
 }
 router.push('/dashboard')
 })
 }

 return (
 <form onSubmit={handleSubmit} className="space-y-5">
 {error && (
 <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-3">
 {error}
 </div>
 )}

 <div className="space-y-1.5">
 <label className="text-sm font-medium text-foreground" htmlFor="password">
 Новый пароль
 </label>
 <div className="relative">
 <input
 id="password"
 type={showPassword ? 'text' : 'password'}
 value={password}
 onChange={e => setPassword(e.target.value)}
 placeholder="••••••••"
 autoComplete="new-password"
 className="w-full h-11 px-4 pr-11 border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm"
 />
 <button
 type="button"
 onClick={() => setShowPassword(!showPassword)}
 className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
 >
 {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
 </button>
 </div>
 </div>

 <div className="space-y-1.5">
 <label className="text-sm font-medium text-foreground" htmlFor="confirm">
 Повторите пароль
 </label>
 <input
 id="confirm"
 type={showPassword ? 'text' : 'password'}
 value={confirm}
 onChange={e => setConfirm(e.target.value)}
 placeholder="••••••••"
 autoComplete="new-password"
 className="w-full h-11 px-4 border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm"
 />
 </div>

 <button
 type="submit"
 disabled={isPending}
 className="w-full h-11 bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
 >
 {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
 {isPending ? 'Сохранение...' : 'Сохранить новый пароль'}
 </button>
 </form>
 )
}
