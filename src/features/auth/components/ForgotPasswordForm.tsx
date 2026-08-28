'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, MailCheck } from 'lucide-react'
import { resetPassword } from '../actions/auth.actions'

export function ForgotPasswordForm() {
 const [email, setEmail] = useState('')
 const [error, setError] = useState<string | null>(null)
 const [sent, setSent] = useState(false)
 const [isPending, startTransition] = useTransition()

 function handleSubmit(e: React.FormEvent) {
 e.preventDefault()
 setError(null)
 if (!email.trim()) {
 setError('Введите email')
 return
 }
 startTransition(async () => {
 const formData = new FormData()
 formData.set('email', email.trim())
 const result = await resetPassword(formData)
 if (result?.error) setError(result.error)
 else setSent(true)
 })
 }

 if (sent) {
 return (
 <div className="space-y-5 text-center">
 <div className="w-14 h-14 flex items-center justify-center mx-auto"
 style={{ background: 'linear-gradient(135deg, rgba(22,163,74,0.1), rgba(34,197,94,0.1))' }}>
 <MailCheck style={{ width: 24, height: 24, color: '#16A34A' }} />
 </div>
 <div>
 <p className="text-foreground font-bold text-base">Проверьте почту</p>
 <p className="text-muted-foreground text-sm mt-1">
 Если аккаунт с email «{email}» существует — мы отправили на него ссылку для сброса пароля.
 </p>
 </div>
 <Link href="/login" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
 <ArrowLeft className="w-4 h-4" />
 Вернуться ко входу
 </Link>
 </div>
 )
 }

 return (
 <form onSubmit={handleSubmit} className="space-y-5">
 {error && (
 <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-3">
 {error}
 </div>
 )}

 <div className="space-y-1.5">
 <label className="text-sm font-medium text-foreground" htmlFor="email">
 Email
 </label>
 <input
 id="email"
 type="email"
 value={email}
 onChange={e => setEmail(e.target.value)}
 placeholder="agent@housepro.ru"
 autoComplete="email"
 className="w-full h-11 px-4 border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm"
 />
 </div>

 <button
 type="submit"
 disabled={isPending}
 className="w-full h-11 bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
 >
 {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
 {isPending ? 'Отправка...' : 'Отправить ссылку для сброса'}
 </button>

 <Link href="/login" className="flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
 <ArrowLeft className="w-4 h-4" />
 Вернуться ко входу
 </Link>
 </form>
 )
}
