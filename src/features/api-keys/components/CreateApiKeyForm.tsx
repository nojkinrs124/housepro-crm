'use client'

import { useState } from 'react'
import { QuickCreateModal } from '@/components/ui/QuickCreateModal'
import { useRouter } from 'next/navigation'
import { Copy, Check, AlertTriangle, Plus } from 'lucide-react'
import { createApiKeyAction } from '../actions/api-keys.actions'

export function CreateApiKeyForm() {
 const [open, setOpen] = useState(false)
 const [loading, setLoading] = useState(false)
 const [newKey, setNewKey] = useState<string | null>(null)
 const [copied, setCopied] = useState(false)
 const [error, setError] = useState<string | null>(null)
 const router = useRouter()

 async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
 e.preventDefault()
 setLoading(true)
 setError(null)
 const fd = new FormData(e.currentTarget)
 const res = await createApiKeyAction(fd)
 setLoading(false)
 if (res?.error) setError(res.error)
 else if (res?.plaintext) {
 setNewKey(res.plaintext)
 router.refresh()
 }
 }

 function copyKey() {
 if (!newKey) return
 navigator.clipboard.writeText(newKey)
 setCopied(true)
 setTimeout(() => setCopied(false), 2000)
 }

 function close() {
 setOpen(false)
 setNewKey(null)
 setError(null)
 }

 if (!open) {
 return (
 <button
 onClick={() => setOpen(true)}
 className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
 >
 <Plus className="w-4 h-4" />
 Создать ключ
 </button>
 )
 }

 return (
 <QuickCreateModal title={newKey ? 'Сохраните ключ' : 'Новый API-ключ'} onClose={close}>
 {newKey ? (
 <div className="space-y-4">
 <div className="flex items-center gap-2 text-[var(--hp-warn)]">
 <AlertTriangle className="w-5 h-5" />
 <p className="font-semibold">Ключ показывается один раз</p>
 </div>
 <p className="text-sm text-muted-foreground">
 Этот ключ показывается только один раз. После закрытия окна его нельзя будет посмотреть снова.
 </p>
 <div className="flex items-center gap-2 p-3 bg-[var(--hp-neutral-tint)] border border-[var(--hp-border)] font-mono text-xs break-all">
 {newKey}
 </div>
 <button
 onClick={copyKey}
 className="w-full flex items-center justify-center gap-2 py-2 border border-[var(--hp-border)] text-sm font-medium hover:bg-[var(--hp-neutral-tint)] transition-colors"
 >
 {copied ? <Check className="w-4 h-4 text-[var(--hp-good)]" /> : <Copy className="w-4 h-4" />}
 {copied ? 'Скопировано' : 'Скопировать ключ'}
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
 <div>
 <label className="block text-sm font-medium mb-1.5">Название</label>
 <input
 name="name"
 required
 placeholder="Интеграция с сайтом"
 className="w-full px-3 py-2 text-sm border border-[var(--hp-border)] outline-none focus:border-[var(--hp-ink)]"
 />
 </div>

 <div>
 <label className="block text-sm font-medium mb-1.5">Доступ</label>
 <select
 name="scope"
 className="w-full px-3 py-2 text-sm border border-[var(--hp-border)] bg-[var(--hp-surface)] outline-none focus:border-[var(--hp-ink)]"
 >
 <option value="read">Только чтение</option>
 <option value="write">Чтение и запись</option>
 </select>
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
 {loading ? 'Создаю…' : 'Создать ключ'}
 </button>
 </form>
 )}
 </QuickCreateModal>
 )
}
