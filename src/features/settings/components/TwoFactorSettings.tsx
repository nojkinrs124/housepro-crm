'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { KeyRound, ShieldCheck, Trash2 } from 'lucide-react'
import {
 enrollMfaAction,
 listMfaFactorsAction,
 unenrollMfaAction,
 verifyMfaAction,
 type MfaFactor,
} from '../actions/mfa.actions'

type Stage = 'idle' | 'enrolling' | 'verifying'

/**
 * Двухфакторная аутентификация (TOTP) поверх Supabase MFA.
 *
 * Вся работа идёт через server actions, а не браузерный клиент Supabase:
 * тот требует NEXT_PUBLIC_SUPABASE_* в бандле, и без них падал при рендере,
 * роняя всю страницу настроек безопасности (см. mfa.actions.ts).
 *
 * QR подставляем через <img src="data:image/svg+xml,...">, а не
 * dangerouslySetInnerHTML: markup из внешнего сервиса не должен попадать
 * в DOM страницы напрямую, даже если сервис доверенный.
 */
export function TwoFactorSettings() {
 const [factors, setFactors] = useState<MfaFactor[]>([])
 const [stage, setStage] = useState<Stage>('idle')
 const [loading, setLoading] = useState(true)
 const [busy, setBusy] = useState(false)
 const [enrollment, setEnrollment] = useState<{ id: string; qr: string; secret: string } | null>(null)
 const [code, setCode] = useState('')

 const loadFactors = useCallback(async () => {
 const res = await listMfaFactorsAction()
 setFactors(res.factors ?? [])
 setLoading(false)
 }, [])

 useEffect(() => {
 void loadFactors()
 }, [loadFactors])

 async function startEnroll() {
 setBusy(true)
 const res = await enrollMfaAction()
 setBusy(false)

 if (res.error || !res.factorId || !res.qr || !res.secret) {
 toast.error(res.error ?? 'Не удалось начать подключение')
 return
 }

 setEnrollment({ id: res.factorId, qr: res.qr, secret: res.secret })
 setStage('enrolling')
 }

 async function confirmEnroll() {
 if (!enrollment) return

 setBusy(true)
 setStage('verifying')
 const res = await verifyMfaAction(enrollment.id, code)
 setBusy(false)

 if (res.error) {
 setStage('enrolling')
 toast.error(res.error)
 return
 }

 toast.success('Двухфакторная аутентификация включена')
 setEnrollment(null)
 setCode('')
 setStage('idle')
 await loadFactors()
 }

 async function removeFactor(factorId: string) {
 if (!confirm('Отключить двухфакторную аутентификацию? Вход снова будет защищён только паролем.')) return
 setBusy(true)
 const res = await unenrollMfaAction(factorId)
 setBusy(false)
 if (res.error) {
 toast.error(res.error)
 return
 }
 toast.success('Двухфакторная аутентификация отключена')
 await loadFactors()
 }

 function cancelEnroll() {
 // Неподтверждённый фактор остаётся в статусе unverified и мешает повторному
 // подключению — убираем его сразу, а не оставляем мусор в аккаунте.
 if (enrollment) void unenrollMfaAction(enrollment.id)
 setEnrollment(null)
 setCode('')
 setStage('idle')
 }

 const verified = factors.filter((f) => f.status === 'verified')

 return (
 <div className="hp-card p-5 space-y-4">
 <div className="flex items-center gap-2">
 <ShieldCheck className="w-4 h-4 text-[var(--hp-sub)]" />
 <h2 className="font-bold text-[var(--hp-ink)] text-[15px]">Двухфакторная аутентификация</h2>
 {verified.length > 0 && <span className="hp-badge hp-badge-good">включена</span>}
 </div>

 <p className="text-sm text-[var(--hp-sub)]">
 Одноразовый код из приложения-аутентификатора (Google Authenticator, Яндекс.Ключ, 1Password)
 в дополнение к паролю. Даже зная пароль, войти в CRM без вашего телефона будет нельзя.
 </p>

 {loading ? (
 <p className="text-sm text-[var(--hp-tertiary)]">Загружаем…</p>
 ) : verified.length > 0 ? (
 <div className="hp-block">
 {verified.map((factor) => (
 <div key={factor.id} className="hp-block-row">
 <span className="label">
 {factor.friendlyName || 'Приложение-аутентификатор'}
 </span>
 <span className="value flex items-center gap-3">
 подключено
 <button
 type="button"
 onClick={() => removeFactor(factor.id)}
 disabled={busy}
 className="text-[var(--hp-danger)] hover:opacity-70 transition-opacity disabled:opacity-50"
 aria-label="Отключить"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </span>
 </div>
 ))}
 </div>
 ) : stage === 'idle' ? (
 <button
 type="button"
 onClick={startEnroll}
 disabled={busy}
 className="flex items-center gap-2 px-5 py-2.5 text-white rounded-[var(--hp-radius)] text-sm font-semibold transition-colors bg-[var(--hp-accent)] hover:bg-[var(--hp-accent-hover)] disabled:opacity-60"
 >
 <KeyRound className="w-4 h-4" />
 {busy ? 'Готовим…' : 'Подключить'}
 </button>
 ) : null}

 {enrollment && (
 <div className="space-y-4 border-t border-[var(--hp-border-soft)] pt-4">
 <p className="text-sm text-[var(--hp-ink)]">
 1. Отсканируйте QR-код приложением-аутентификатором.
 </p>
 <QrImage svg={enrollment.qr} />

 <div className="space-y-1.5">
 <p className="text-sm text-[var(--hp-ink)]">
 Если камера недоступна — введите ключ вручную:
 </p>
 <code className="block px-3 py-2 bg-[var(--hp-neutral-tint)] border border-[var(--hp-border)] text-xs text-[var(--hp-ink)] break-all">
 {enrollment.secret}
 </code>
 </div>

 <div className="space-y-1.5">
 <label className="hp-label" htmlFor="mfa-code">2. Введите код из приложения</label>
 <input
 id="mfa-code"
 inputMode="numeric"
 autoComplete="one-time-code"
 maxLength={6}
 value={code}
 onChange={(e) => setCode(e.target.value)}
 placeholder="000000"
 className="hp-input max-w-[180px] tracking-[0.3em]"
 />
 </div>

 <div className="flex items-center gap-3 flex-wrap">
 <button
 type="button"
 onClick={confirmEnroll}
 disabled={busy || stage === 'verifying'}
 className="px-5 py-2.5 text-white rounded-[var(--hp-radius)] text-sm font-semibold transition-colors bg-[var(--hp-accent)] hover:bg-[var(--hp-accent-hover)] disabled:opacity-60"
 >
 {busy ? 'Проверяем…' : 'Подтвердить'}
 </button>
 <button
 type="button"
 onClick={cancelEnroll}
 disabled={busy}
 className="px-5 py-2.5 bg-[var(--hp-surface)] border border-[var(--hp-border)] rounded-[var(--hp-radius)] text-sm font-semibold text-[var(--hp-ink)] hover:border-[var(--hp-sub)] transition-colors"
 >
 Отмена
 </button>
 </div>
 </div>
 )}
 </div>
 )
}

/**
 * Supabase отдаёт QR либо готовым data-URI, либо сырым SVG — поддерживаем оба,
 * приводя к data-URI и показывая обычной картинкой.
 */
function QrImage({ svg }: { svg: string }) {
 const src = svg.startsWith('data:') ? svg : `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
 // eslint-disable-next-line @next/next/no-img-element
 return (
 <img
 src={src}
 alt="QR-код для приложения-аутентификатора"
 width={180}
 height={180}
 className="border border-[var(--hp-border)] bg-white p-2"
 />
 )
}
