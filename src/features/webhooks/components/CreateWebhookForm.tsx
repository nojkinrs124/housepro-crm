'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Webhook, Copy, Check, AlertTriangle, Plus, X } from 'lucide-react'
import { createWebhookAction } from '../actions/webhooks.actions'

const EVENTS = [
 { value: 'lead.created', label: 'Новый лид' },
 { value: 'deal.created', label: 'Новая сделка' },
 { value: 'contract.created', label: 'Новый договор' },
 { value: 'payment.received', label: 'Получен платёж' },
]

export function CreateWebhookForm() {
 const [open, setOpen] = useState(false)
 const [loading, setLoading] = useState(false)
 const [newSecret, setNewSecret] = useState<string | null>(null)
 const [copied, setCopied] = useState(false)
 const [error, setError] = useState<string | null>(null)
 const router = useRouter()

 async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
 e.preventDefault()
 setLoading(true)
 setError(null)
 const fd = new FormData(e.currentTarget)
 const res = await createWebhookAction(fd)
 setLoading(false)
 if (res?.error) setError(res.error)
 else if (res?.secret) {
 setNewSecret(res.secret)
 router.refresh()
 }
 }

 function copySecret() {
 if (!newSecret) return
 navigator.clipboard.writeText(newSecret)
 setCopied(true)
 setTimeout(() => setCopied(false), 2000)
 }

 function close() {
 setOpen(false)
 setNewSecret(null)
 setError(null)
 }

 if (!open) {
 return (
 <button
 onClick={() => setOpen(true)}
 className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
 >
 <Plus className="w-4 h-4" />
 Добавить вебхук
 </button>
 )
 }

 return (
 <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={close}>
 <div className="bg-white p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
 {newSecret ? (
 <div className="space-y-4">
 <div className="flex items-center gap-2 text-[var(--hp-warn)]">
 <AlertTriangle className="w-5 h-5" />
 <h2 className="font-semibold">Сохраните secret сейчас</h2>
 </div>
 <p className="text-sm text-muted-foreground">
 Используйте этот secret для проверки подписи HMAC-SHA256 в заголовке <code className="text-xs">X-HousePro-Signature</code>.
 </p>
 <div className="flex items-center gap-2 p-3 bg-[var(--hp-neutral-tint)] border border-[var(--hp-border)] font-mono text-xs break-all">
 {newSecret}
 </div>
 <button
 onClick={copySecret}
 className="w-full flex items-center justify-center gap-2 py-2 border border-[var(--hp-border)] text-sm font-medium hover:bg-[var(--hp-neutral-tint)] transition-colors"
 >
 {copied ? <Check className="w-4 h-4 text-[var(--hp-good)]" /> : <Copy className="w-4 h-4" />}
 {copied ? 'Скопировано' : 'Скопировать secret'}
 </button>
 <button
 onClick={close}
 className="w-full py-2 bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
 >
 Готово
 </button>
 </div>
 ) : (
 <form onSubmit={handleSubmit} className="space-y-4">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Webhook className="w-4 h-4 text-primary" />
 <h2 className="font-semibold">Новый вебхук</h2>
 </div>
 <button type="button" onClick={close} className="text-muted-foreground hover:text-foreground">
 <X className="w-4 h-4" />
 </button>
 </div>

 <div>
 <label className="block text-sm font-medium mb-1.5">URL эндпоинта</label>
 <input
 name="url"
 type="url"
 required
 placeholder="https://your-app.com/webhooks/housepro"
 className="w-full px-3 py-2 text-sm border border-[var(--hp-border)] outline-none focus:border-[var(--hp-ink)]"
 />
 </div>

 <div>
 <label className="block text-sm font-medium mb-1.5">События</label>
 <div className="space-y-2">
 {EVENTS.map(ev => (
 <label key={ev.value} className="flex items-center gap-2 text-sm cursor-pointer">
 <input type="checkbox" name="events" value={ev.value} className="accent-primary" />
 {ev.label}
 </label>
 ))}
 </div>
 </div>

 {error && (
 <div className="px-3 py-2 bg-[var(--hp-danger-tint)] border border-[var(--hp-border)] text-sm text-[var(--hp-danger)]">
 {error}
 </div>
 )}

 <button
 type="submit"
 disabled={loading}
 className="w-full py-2 bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
 >
 {loading ? 'Создаю…' : 'Добавить вебхук'}
 </button>
 </form>
 )}
 </div>
 </div>
 )
}
