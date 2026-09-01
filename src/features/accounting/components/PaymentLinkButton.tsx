'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { CreditCard, ExternalLink, Mail } from 'lucide-react'
import { createPaymentLinkAction } from '../actions/payment-link.actions'

/**
 * Кнопка «Ссылка на оплату» у планового начисления.
 *
 * Две операции вместо одной: создать ссылку (и скопировать её, чтобы отправить
 * клиенту любым каналом) и сразу отправить письмом. Агентства пользуются
 * и тем, и другим — кто-то шлёт ссылку в WhatsApp.
 */
export function PaymentLinkButton({
 transactionId,
 status,
 existingUrl,
}: {
 transactionId: string
 status: string
 existingUrl?: string | null
}) {
 const [url, setUrl] = useState<string | null>(existingUrl ?? null)
 const [isPending, startTransition] = useTransition()

 if (status === 'completed' || status === 'cancelled') return null

 function run(sendEmail: boolean) {
 startTransition(async () => {
 const res = await createPaymentLinkAction(transactionId, { sendEmail })
 if (res.error) { toast.error(res.error); return }
 if (res.url) setUrl(res.url)
 toast.success(res.message ?? 'Готово')
 if (!sendEmail && res.url) {
 try {
 await navigator.clipboard.writeText(res.url)
 toast.success('Ссылка скопирована')
 } catch {
 // Буфер недоступен (нет https или отказ в правах) — ссылка всё равно
 // показана рядом кнопкой «открыть».
 }
 }
 })
 }

 return (
 <div className="flex items-center gap-1">
 <button
 type="button"
 onClick={() => run(false)}
 disabled={isPending}
 title={url ? 'Скопировать ссылку на оплату' : 'Создать ссылку на оплату'}
 className="p-1.5 text-[var(--hp-sub)] hover:text-[var(--hp-ink)] hover:bg-[var(--hp-neutral-tint)] transition-colors disabled:opacity-50"
 >
 <CreditCard className="w-4 h-4" />
 </button>
 <button
 type="button"
 onClick={() => run(true)}
 disabled={isPending}
 title="Отправить ссылку клиенту письмом"
 className="p-1.5 text-[var(--hp-sub)] hover:text-[var(--hp-ink)] hover:bg-[var(--hp-neutral-tint)] transition-colors disabled:opacity-50"
 >
 <Mail className="w-4 h-4" />
 </button>
 {url && (
 <a
 href={url}
 target="_blank"
 rel="noopener noreferrer"
 title="Открыть страницу оплаты"
 className="p-1.5 text-[var(--hp-sub)] hover:text-[var(--hp-ink)] hover:bg-[var(--hp-neutral-tint)] transition-colors"
 >
 <ExternalLink className="w-4 h-4" />
 </a>
 )}
 </div>
 )
}
