'use client'

import { useState } from 'react'
import { CreditCard, ExternalLink, Loader2 } from 'lucide-react'

interface Props {
 planId?: string
 hasCustomer?: boolean
}

export function BillingActions({ planId, hasCustomer }: Props) {
 const [loading, setLoading] = useState(false)

 async function handleCheckout() {
 if (!planId) return
 setLoading(true)
 try {
 const res = await fetch('/api/billing/checkout', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ plan: planId }),
 })
 const data = await res.json()
 if (data.url) window.location.href = data.url
 else alert(data.error ?? 'Ошибка при создании сессии оплаты')
 } finally {
 setLoading(false)
 }
 }

 async function handlePortal() {
 setLoading(true)
 try {
 const res = await fetch('/api/billing/portal', { method: 'POST' })
 const data = await res.json()
 if (data.url) window.location.href = data.url
 else alert(data.error ?? 'Ошибка при открытии портала')
 } finally {
 setLoading(false)
 }
 }

 if (hasCustomer) {
 return (
 <button
 onClick={handlePortal}
 disabled={loading}
 className="flex items-center gap-2 px-4 py-2 border border-[var(--hp-border)] text-sm font-medium hover:bg-[var(--hp-neutral-tint)] transition-colors disabled:opacity-50"
 >
 {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
 Управление подпиской
 </button>
 )
 }

 return (
 <button
 onClick={handleCheckout}
 disabled={loading}
 className="w-full flex items-center justify-center gap-2 py-2 bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
 >
 {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
 Выбрать
 </button>
 )
}
