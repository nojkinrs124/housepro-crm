'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Key, Trash2, Power } from 'lucide-react'
import { revokeApiKeyAction, deleteApiKeyAction } from '../actions/api-keys.actions'

interface Props {
 id: string
 name: string
 keyPrefix: string
 scopes: string[]
 isActive: boolean
 lastUsedAt: string | null
 createdAt: string
}

export function ApiKeyRow({ id, name, keyPrefix, scopes, isActive, lastUsedAt, createdAt }: Props) {
 const [loading, setLoading] = useState(false)
 const router = useRouter()

 async function handleRevoke() {
 setLoading(true)
 await revokeApiKeyAction(id)
 setLoading(false)
 router.refresh()
 }

 async function handleDelete() {
 if (!confirm(`Удалить ключ «${name}»? Это действие нельзя отменить.`)) return
 setLoading(true)
 await deleteApiKeyAction(id)
 setLoading(false)
 router.refresh()
 }

 return (
 <div className="flex items-center justify-between gap-4 px-5 py-3.5 bg-white border border-slate-100">
 <div className="flex items-start gap-3 min-w-0">
 <div className={`w-8 h-8 flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-primary/10' : 'bg-slate-100'}`}>
 <Key className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-slate-400'}`} />
 </div>
 <div className="min-w-0">
 <div className="flex items-center gap-2">
 <span className="font-medium text-foreground">{name}</span>
 {!isActive && (
 <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-full">Отозван</span>
 )}
 </div>
 <div className="text-xs text-muted-foreground font-mono mt-0.5">{keyPrefix}…</div>
 <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
 <span>{scopes.includes('write') ? 'Чтение и запись' : 'Только чтение'}</span>
 <span>·</span>
 <span>{lastUsedAt ? `Использован: ${new Date(lastUsedAt).toLocaleDateString('ru-RU')}` : 'Не использовался'}</span>
 </div>
 </div>
 </div>

 <div className="flex items-center gap-1 flex-shrink-0">
 {isActive && (
 <button
 onClick={handleRevoke}
 disabled={loading}
 title="Отозвать ключ"
 className="p-1.5 text-muted-foreground hover:text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-50"
 >
 <Power className="w-3.5 h-3.5" />
 </button>
 )}
 <button
 onClick={handleDelete}
 disabled={loading}
 title="Удалить ключ"
 className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
 >
 <Trash2 className="w-3.5 h-3.5" />
 </button>
 </div>
 </div>
 )
}
