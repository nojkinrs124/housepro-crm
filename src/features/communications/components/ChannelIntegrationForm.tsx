'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { AlertCircle, Copy, RefreshCw } from 'lucide-react'
import {
 regenerateWebhookSecretAction,
 saveChannelIntegrationAction,
} from '../actions/communications.actions'

type State = { error?: string; success?: boolean } | undefined

export interface CredentialField {
 name: string
 label: string
 hint?: string
}

interface ChannelIntegrationFormProps {
 kind: 'telephony' | 'whatsapp' | 'payments' | 'signing'
 /** Путь роута вебхука: /api/<webhookPath>/... */
 webhookPath?: string
 title: string
 description: string
 providers: { value: string; label: string }[]
 /** Поля учётных данных для каждого провайдера. */
 credentialFields: Record<string, CredentialField[]>
 current: {
 provider: string | null
 isActive: boolean
 webhookSecret: string | null
 /** Имена уже заполненных полей — значения не передаются в браузер. */
 filledCredentials: string[]
 } | null
 siteUrl: string
}

/**
 * Настройка канала связи. Секреты провайдера в браузер не отдаются: форма
 * показывает лишь, какие поля уже заполнены, а пустое поле при сохранении
 * означает «оставить как есть» (см. saveChannelIntegrationAction).
 */
export function ChannelIntegrationForm({
 kind,
 webhookPath,
 title,
 description,
 providers,
 credentialFields,
 current,
 siteUrl,
}: ChannelIntegrationFormProps) {
 const [provider, setProvider] = useState(current?.provider ?? providers[0]?.value ?? '')
 const [isRegenerating, startRegenerate] = useTransition()

 const bound = saveChannelIntegrationAction.bind(null, kind)
 const [state, formAction, isPending] = useActionState(
 async (prev: State, formData: FormData): Promise<State> => (await bound(prev, formData)) as State,
 undefined
 )

 useEffect(() => {
 if (state?.success) toast.success('Настройки сохранены')
 }, [state])

 const fields = credentialFields[provider] ?? []
 // Провайдер входит в путь у всех трёх видов интеграций: адаптер выбирается
 // по нему, а секрет в query определяет организацию.
 const base = webhookPath ?? kind
 const webhookUrl = current?.webhookSecret
 ? `${siteUrl}/api/${base}/${current.provider}?secret=${current.webhookSecret}`
 : null

 async function copyWebhook() {
 if (!webhookUrl) return
 try {
 await navigator.clipboard.writeText(webhookUrl)
 toast.success('Адрес скопирован')
 } catch {
 toast.error('Не удалось скопировать — выделите адрес вручную')
 }
 }

 function regenerate() {
 if (!confirm('Перевыпустить секрет? Старый адрес вебхука перестанет приниматься.')) return
 startRegenerate(async () => {
 const res = await regenerateWebhookSecretAction(kind)
 if (res.error) { toast.error(res.error); return }
 toast.success('Секрет перевыпущен — обновите адрес у провайдера')
 })
 }

 return (
 <form action={formAction} className="hp-card p-5 space-y-4">
 <div>
 <h2 className="font-bold text-[var(--hp-ink)] text-[15px]">{title}</h2>
 <p className="text-sm text-[var(--hp-sub)] mt-1">{description}</p>
 </div>

 {state?.error && (
 <div className="flex items-start gap-2 border border-[var(--hp-border)] bg-[var(--hp-danger-tint)] px-4 py-3 text-sm text-[var(--hp-danger)]">
 <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
 {state.error}
 </div>
 )}

 <fieldset disabled={isPending} className="contents">
 <div className="space-y-1.5">
 <label className="hp-label" htmlFor={`${kind}-provider`}>Провайдер</label>
 <select
 id={`${kind}-provider`}
 name="provider"
 value={provider}
 onChange={(e) => setProvider(e.target.value)}
 className="w-full h-10 px-4 rounded-[var(--hp-radius)] border border-[var(--hp-border)] bg-[var(--hp-surface)] text-[var(--hp-ink)] text-sm outline-none focus:border-[var(--hp-ink)] cursor-pointer transition-colors"
 >
 {providers.map((p) => (
 <option key={p.value} value={p.value}>{p.label}</option>
 ))}
 </select>
 </div>

 {fields.map((field) => {
 const filled = current?.filledCredentials.includes(field.name)
 return (
 <div key={field.name} className="space-y-1.5">
 <label className="hp-label" htmlFor={`${kind}-${field.name}`}>{field.label}</label>
 <input
 id={`${kind}-${field.name}`}
 name={`cred_${field.name}`}
 placeholder={filled ? '•••••••• (сохранено, оставьте пустым)' : ''}
 autoComplete="off"
 className="hp-input"
 />
 {field.hint && <p className="text-xs text-[var(--hp-sub)]">{field.hint}</p>}
 </div>
 )
 })}

 <label className="flex items-center gap-2 text-sm text-[var(--hp-ink)]">
 <input type="checkbox" name="is_active" defaultChecked={current?.isActive ?? true} />
 Канал включён
 </label>

 <button
 type="submit"
 className="px-5 py-2.5 text-white rounded-[var(--hp-radius)] text-sm font-semibold transition-colors bg-[var(--hp-accent)] hover:bg-[var(--hp-accent-hover)] disabled:opacity-60"
 >
 {isPending ? 'Сохраняем…' : 'Сохранить'}
 </button>
 </fieldset>

 {webhookUrl && (
 <div className="border-t border-[var(--hp-border-soft)] pt-4 space-y-2">
 <p className="hp-label">Адрес вебхука — вставьте его в личном кабинете провайдера</p>
 <code className="block px-3 py-2 bg-[var(--hp-neutral-tint)] border border-[var(--hp-border)] text-xs text-[var(--hp-ink)] break-all">
 {webhookUrl}
 </code>
 <div className="flex items-center gap-2 flex-wrap">
 <button
 type="button"
 onClick={copyWebhook}
 className="flex items-center gap-2 px-4 py-2 border border-[var(--hp-border)] rounded-[var(--hp-radius)] text-sm font-medium text-[var(--hp-ink)] hover:border-[var(--hp-sub)] transition-colors"
 >
 <Copy className="w-4 h-4" />
 Скопировать
 </button>
 <button
 type="button"
 onClick={regenerate}
 disabled={isRegenerating}
 className="flex items-center gap-2 px-4 py-2 border border-[var(--hp-border)] rounded-[var(--hp-radius)] text-sm font-medium text-[var(--hp-ink)] hover:border-[var(--hp-sub)] transition-colors disabled:opacity-60"
 >
 <RefreshCw className="w-4 h-4" />
 Перевыпустить секрет
 </button>
 </div>
 <p className="text-xs text-[var(--hp-sub)]">
 Секрет в адресе определяет вашу организацию — не публикуйте эту ссылку.
 </p>
 </div>
 )}

 {!webhookUrl && (
 <p className="text-xs text-[var(--hp-sub)]">
 Адрес вебхука появится здесь после первого сохранения настроек.
 </p>
 )}
 </form>
 )
}
