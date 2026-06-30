'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Webhook, Trash2, Power, PowerOff } from 'lucide-react'
import { toggleWebhookAction, deleteWebhookAction } from '../actions/webhooks.actions'

const EVENT_LABELS: Record<string, string> = {
  'lead.created':     'Новый лид',
  'deal.created':     'Новая сделка',
  'contract.created': 'Новый договор',
  'payment.received': 'Получен платёж',
}

interface Props {
  id: string
  url: string
  events: string[]
  isActive: boolean
}

export function WebhookRow({ id, url, events, isActive }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleToggle() {
    setLoading(true)
    await toggleWebhookAction(id, !isActive)
    setLoading(false)
    router.refresh()
  }

  async function handleDelete() {
    if (!confirm('Удалить вебхук?')) return
    setLoading(true)
    await deleteWebhookAction(id)
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5 bg-white border border-slate-100 rounded-xl">
      <div className="flex items-start gap-3 min-w-0">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-primary/10' : 'bg-slate-100'}`}>
          <Webhook className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-slate-400'}`} />
        </div>
        <div className="min-w-0">
          <div className="font-mono text-sm text-foreground truncate">{url}</div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {events.map(e => (
              <span key={e} className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                {EVENT_LABELS[e] ?? e}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={handleToggle}
          disabled={loading}
          title={isActive ? 'Отключить' : 'Включить'}
          className="p-1.5 text-muted-foreground hover:text-amber-600 rounded-lg hover:bg-amber-50 transition-colors disabled:opacity-50"
        >
          {isActive ? <Power className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={handleDelete}
          disabled={loading}
          title="Удалить"
          className="p-1.5 text-muted-foreground hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
