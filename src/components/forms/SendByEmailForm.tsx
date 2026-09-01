'use client'

import { useActionState, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AlertCircle, Mail, Send } from 'lucide-react'

type Result = { error?: string; success?: boolean; message?: string } | undefined

interface SendByEmailFormProps {
 /** Server Action, уже забинженный на id сущности: (formData) => Result. */
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 action: (formData: FormData) => Promise<any>
 /** Подставляется в поле — обычно email клиента из карточки. */
 defaultEmail?: string | null
 title?: string
 hint?: string
 submitLabel?: string
 /** Поле «комментарий» нужно не всем отправкам. */
 withComment?: boolean
}

/**
 * Общая форма «отправить письмом» — используется на карточке договора и подборки.
 * Свёрнута по умолчанию: на детальной странице и так тесно от кнопок, а отправка
 * письма — не то действие, которое должно занимать место постоянно.
 */
export function SendByEmailForm({
 action,
 defaultEmail,
 title = 'Отправить на email',
 hint,
 submitLabel = 'Отправить',
 withComment = true,
}: SendByEmailFormProps) {
 const [open, setOpen] = useState(false)

 const wrapped = async (_prev: Result, formData: FormData): Promise<Result> =>
 (await action(formData)) as Result
 const [state, formAction, isPending] = useActionState(wrapped, undefined)

 useEffect(() => {
 if (state?.success) {
 toast.success(state.message ?? 'Письмо отправлено')
 setOpen(false)
 }
 }, [state])

 if (!open) {
 return (
 <button
 type="button"
 onClick={() => setOpen(true)}
 className="flex items-center gap-2 px-4 py-2 border border-[var(--hp-border)] rounded-[var(--hp-radius)] text-sm font-medium text-[var(--hp-ink)] hover:border-[var(--hp-sub)] transition-colors whitespace-nowrap"
 >
 <Mail className="w-4 h-4" />
 {title}
 </button>
 )
 }

 return (
 <form action={formAction} className="hp-card p-5 space-y-4 w-full">
 <h2 className="font-bold text-[var(--hp-ink)] text-[15px]">{title}</h2>
 {hint && <p className="text-[var(--hp-sub)] text-sm">{hint}</p>}

 {state?.error && (
 <div className="flex items-center gap-2 border border-[var(--hp-border)] bg-[var(--hp-danger-tint)] px-4 py-3 text-sm text-[var(--hp-danger)]">
 <AlertCircle className="w-4 h-4 shrink-0" />
 {state.error}
 </div>
 )}

 <fieldset disabled={isPending} className="contents">
 <div className="space-y-1.5">
 <label className="hp-label" htmlFor="send-email-address">Email получателя</label>
 <input
 id="send-email-address"
 type="email"
 name="email"
 defaultValue={defaultEmail ?? ''}
 placeholder="client@example.com"
 className="hp-input"
 />
 </div>

 {withComment && (
 <div className="space-y-1.5">
 <label className="hp-label" htmlFor="send-email-comment">Комментарий (необязательно)</label>
 <textarea
 id="send-email-comment"
 name="comment"
 rows={3}
 placeholder="Пара слов клиенту — попадёт в текст письма"
 className="w-full px-4 py-2.5 rounded-[var(--hp-radius)] border border-[var(--hp-border)] bg-[var(--hp-surface)] text-[var(--hp-ink)] placeholder:text-[var(--hp-tertiary)] text-sm outline-none focus:border-[var(--hp-ink)] transition-colors resize-none"
 />
 </div>
 )}

 <div className="flex items-center gap-3 flex-wrap">
 <button
 type="submit"
 className="flex items-center gap-2 px-5 py-2.5 text-white rounded-[var(--hp-radius)] text-sm font-semibold transition-colors bg-[var(--hp-accent)] hover:bg-[var(--hp-accent-hover)] disabled:opacity-60"
 >
 <Send className="w-4 h-4" />
 {isPending ? 'Отправляем…' : submitLabel}
 </button>
 <button
 type="button"
 onClick={() => setOpen(false)}
 className="px-5 py-2.5 bg-[var(--hp-surface)] border border-[var(--hp-border)] rounded-[var(--hp-radius)] text-sm font-semibold text-[var(--hp-ink)] hover:border-[var(--hp-sub)] transition-colors"
 >
 Отмена
 </button>
 </div>
 </fieldset>
 </form>
 )
}
