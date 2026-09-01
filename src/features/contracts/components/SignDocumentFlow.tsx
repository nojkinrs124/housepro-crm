'use client'

import { useState, useTransition } from 'react'
import { AlertCircle, CheckCircle2, Mail, ShieldCheck } from 'lucide-react'
import { confirmSignAction, requestSignCodeAction } from '../actions/signing.actions'

type Stage = 'intro' | 'code' | 'signed'

/**
 * Подписание договора простой электронной подписью.
 *
 * Два шага: запросить код на почту и ввести его. Разделение намеренное —
 * подписант должен сначала открыть и прочитать документ, а код служит
 * подтверждением личности, а не кнопкой «согласен».
 */
export function SignDocumentFlow({
 token,
 maskedEmail,
 alreadySigned,
 signedAt,
}: {
 token: string
 maskedEmail: string | null
 alreadySigned: boolean
 signedAt: string | null
}) {
 const [stage, setStage] = useState<Stage>(alreadySigned ? 'signed' : 'intro')
 const [code, setCode] = useState('')
 const [error, setError] = useState<string | null>(null)
 const [notice, setNotice] = useState<string | null>(null)
 const [isPending, startTransition] = useTransition()

 function requestCode() {
 setError(null)
 startTransition(async () => {
 const res = await requestSignCodeAction(token)
 if (res.error) {
 setError(res.error)
 return
 }
 setNotice(res.message ?? 'Код отправлен')
 setStage('code')
 })
 }

 function confirm() {
 setError(null)
 startTransition(async () => {
 const res = await confirmSignAction(token, code)
 if (res.error) {
 setError(res.error)
 return
 }
 setStage('signed')
 })
 }

 if (stage === 'signed') {
 return (
 <div className="hp-card p-5 space-y-2">
 <div className="flex items-center gap-2">
 <CheckCircle2 className="w-5 h-5 text-[var(--hp-good)]" />
 <h2 className="font-bold text-[var(--hp-ink)] text-[15px]">Договор подписан</h2>
 </div>
 <p className="text-sm text-[var(--hp-sub)]">
 {signedAt
 ? `Подписано ${new Date(signedAt).toLocaleString('ru-RU')}.`
 : 'Подпись зафиксирована.'}{' '}
 Экземпляр остаётся у агентства, копию можно скачать по ссылке выше.
 </p>
 </div>
 )
 }

 return (
 <div className="hp-card p-5 space-y-4">
 <div className="flex items-center gap-2">
 <ShieldCheck className="w-4 h-4 text-[var(--hp-sub)]" />
 <h2 className="font-bold text-[var(--hp-ink)] text-[15px]">Подписание</h2>
 </div>

 {error && (
 <div className="flex items-start gap-2 border border-[var(--hp-border)] bg-[var(--hp-danger-tint)] px-4 py-3 text-sm text-[var(--hp-danger)]">
 <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
 {error}
 </div>
 )}

 {stage === 'intro' ? (
 <>
 <p className="text-sm text-[var(--hp-sub)]">
 Скачайте и прочитайте документ. Затем запросите код подтверждения — он придёт
 на почту {maskedEmail ?? 'подписанта'}. Ввод кода означает подписание договора
 простой электронной подписью.
 </p>
 <button
 type="button"
 onClick={requestCode}
 disabled={isPending}
 className="flex items-center gap-2 px-5 py-2.5 text-white rounded-[var(--hp-radius)] text-sm font-semibold transition-colors bg-[var(--hp-accent)] hover:bg-[var(--hp-accent-hover)] disabled:opacity-60"
 >
 <Mail className="w-4 h-4" />
 {isPending ? 'Отправляем…' : 'Получить код подтверждения'}
 </button>
 </>
 ) : (
 <>
 {notice && <p className="text-sm text-[var(--hp-good)]">{notice}</p>}
 <div className="space-y-1.5">
 <label className="hp-label" htmlFor="sign-code">Код из письма</label>
 <input
 id="sign-code"
 inputMode="numeric"
 autoComplete="one-time-code"
 maxLength={6}
 value={code}
 onChange={(e) => setCode(e.target.value)}
 placeholder="000000"
 className="hp-input max-w-[200px] tracking-[0.3em]"
 />
 </div>
 <div className="flex items-center gap-3 flex-wrap">
 <button
 type="button"
 onClick={confirm}
 disabled={isPending || code.replace(/\D/g, '').length !== 6}
 className="px-5 py-2.5 text-white rounded-[var(--hp-radius)] text-sm font-semibold transition-colors bg-[var(--hp-accent)] hover:bg-[var(--hp-accent-hover)] disabled:opacity-50"
 >
 {isPending ? 'Проверяем…' : 'Подписать договор'}
 </button>
 <button
 type="button"
 onClick={requestCode}
 disabled={isPending}
 className="px-5 py-2.5 bg-[var(--hp-surface)] border border-[var(--hp-border)] rounded-[var(--hp-radius)] text-sm font-semibold text-[var(--hp-ink)] hover:border-[var(--hp-sub)] transition-colors"
 >
 Выслать код заново
 </button>
 </div>
 </>
 )}

 <p className="text-xs text-[var(--hp-sub)]">
 Подписание кодом — простая электронная подпись (ст. 5 № 63-ФЗ). Фиксируются время,
 IP-адрес и контрольная сумма файла: подменить подписанный документ после этого нельзя.
 </p>
 </div>
 )
}
