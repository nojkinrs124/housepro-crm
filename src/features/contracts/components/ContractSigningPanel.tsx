'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Copy, PenLine } from 'lucide-react'
import { createSignatureRequestAction } from '../actions/signing.actions'

export interface SignatureSummary {
 id: string
 status: string
 signer_email: string | null
 signer_name: string | null
 signed_at: string | null
 created_at: string
 expires_at: string
 sign_token: string
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
 pending: { label: 'Ссылка отправлена', className: 'hp-badge hp-badge-info' },
 viewed: { label: 'Документ открыт', className: 'hp-badge hp-badge-warn' },
 signed: { label: 'Подписан', className: 'hp-badge hp-badge-good' },
 declined: { label: 'Отказ', className: 'hp-badge hp-badge-danger' },
 expired: { label: 'Просрочена', className: 'hp-badge hp-badge-neutral' },
}

/**
 * Отправка договора на подписание и статус подписей.
 *
 * Показывается только когда DOCX уже сформирован: подписывать нечего, пока
 * файла нет, а неактивная кнопка без объяснения раздражает сильнее её отсутствия.
 */
export function ContractSigningPanel({
 contractId,
 defaultEmail,
 signatures,
 siteUrl,
}: {
 contractId: string
 defaultEmail: string | null
 signatures: SignatureSummary[]
 siteUrl: string
}) {
 const [open, setOpen] = useState(false)
 const [isPending, startTransition] = useTransition()

 function submit(formData: FormData) {
 startTransition(async () => {
 const res = await createSignatureRequestAction(contractId, formData)
 if (res.error) {
 toast.error(res.error)
 return
 }
 toast.success(res.message ?? 'Ссылка отправлена')
 setOpen(false)
 })
 }

 async function copyLink(token: string) {
 try {
 await navigator.clipboard.writeText(`${siteUrl}/sign/${token}`)
 toast.success('Ссылка скопирована')
 } catch {
 toast.error('Не удалось скопировать — откройте ссылку вручную')
 }
 }

 const active = signatures.filter((s) => s.status !== 'expired')

 return (
 <div className="hp-card p-5 space-y-4">
 <div className="flex items-center justify-between gap-3 flex-wrap">
 <div className="flex items-center gap-2">
 <PenLine className="w-4 h-4 text-[var(--hp-sub)]" />
 <h2 className="font-bold text-[var(--hp-ink)] text-[15px]">Электронная подпись</h2>
 </div>
 {!open && (
 <button
 type="button"
 onClick={() => setOpen(true)}
 className="text-sm font-medium text-[var(--hp-sub)] hover:text-[var(--hp-ink)] transition-colors"
 >
 {active.length > 0 ? 'Отправить ещё раз' : 'Отправить на подпись'}
 </button>
 )}
 </div>

 {active.length === 0 && !open && (
 <p className="text-sm text-[var(--hp-sub)]">
 Клиент получит ссылку на документ и подтвердит подписание кодом из письма.
 Фиксируются время, IP и контрольная сумма файла.
 </p>
 )}

 {active.length > 0 && (
 <div className="hp-block">
 {active.map((signature) => {
 const meta = STATUS_LABELS[signature.status] ?? STATUS_LABELS.pending
 return (
 <div key={signature.id} className="hp-block-row">
 <span className="label">
 {signature.signer_email ?? signature.signer_name ?? 'Подписант'}
 <span className="block text-[11px] text-[var(--hp-tertiary)]">
 {signature.signed_at
 ? `подписано ${new Date(signature.signed_at).toLocaleString('ru-RU')}`
 : `отправлено ${new Date(signature.created_at).toLocaleDateString('ru-RU')}`}
 </span>
 </span>
 <span className="value flex items-center gap-2">
 <span className={meta.className}>{meta.label}</span>
 {signature.status !== 'signed' && (
 <button
 type="button"
 onClick={() => copyLink(signature.sign_token)}
 title="Скопировать ссылку на подписание"
 className="text-[var(--hp-sub)] hover:text-[var(--hp-ink)] transition-colors"
 >
 <Copy className="w-3.5 h-3.5" />
 </button>
 )}
 </span>
 </div>
 )
 })}
 </div>
 )}

 {open && (
 <form action={submit} className="space-y-3 border-t border-[var(--hp-border-soft)] pt-4">
 <div className="space-y-1.5">
 <label className="hp-label" htmlFor="sign-signer-email">Email подписанта</label>
 <input
 id="sign-signer-email"
 type="email"
 name="email"
 defaultValue={defaultEmail ?? ''}
 placeholder="client@example.com"
 className="hp-input"
 />
 </div>
 <div className="space-y-1.5">
 <label className="hp-label" htmlFor="sign-signer-name">ФИО подписанта</label>
 <input id="sign-signer-name" name="signer_name" placeholder="Иванов Иван Иванович" className="hp-input" />
 </div>
 <div className="flex items-center gap-3 flex-wrap">
 <button
 type="submit"
 disabled={isPending}
 className="px-5 py-2.5 text-white rounded-[var(--hp-radius)] text-sm font-semibold transition-colors bg-[var(--hp-accent)] hover:bg-[var(--hp-accent-hover)] disabled:opacity-60"
 >
 {isPending ? 'Отправляем…' : 'Отправить на подпись'}
 </button>
 <button
 type="button"
 onClick={() => setOpen(false)}
 className="px-5 py-2.5 bg-[var(--hp-surface)] border border-[var(--hp-border)] rounded-[var(--hp-radius)] text-sm font-semibold text-[var(--hp-ink)] hover:border-[var(--hp-sub)] transition-colors"
 >
 Отмена
 </button>
 </div>
 </form>
 )}
 </div>
 )
}
