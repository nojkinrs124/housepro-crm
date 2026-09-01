'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Copy, Download, RefreshCw, Send, Signature } from 'lucide-react'
import {
  refreshPodpislonStatusAction,
  resendPodpislonLinkAction,
  sendContractToPodpislonAction,
} from '../actions/podpislon.actions'

export interface PodpislonSignature {
  id: string
  status: string
  signer_name: string | null
  signer_phone: string | null
  sign_url: string | null
  signed_at: string | null
  created_at: string
  signed_document_url: string | null
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: 'Отправлен', className: 'hp-badge hp-badge-info' },
  viewed: { label: 'Открыт клиентом', className: 'hp-badge hp-badge-warn' },
  signed: { label: 'Подписан', className: 'hp-badge hp-badge-good' },
  declined: { label: 'Аннулирован', className: 'hp-badge hp-badge-danger' },
  expired: { label: 'Просрочен', className: 'hp-badge hp-badge-neutral' },
}

/**
 * Отправка договора на подпись через Подпислон — код из СМС на телефон клиента.
 *
 * Панель показывается только при подключённой интеграции и уже сформированном
 * файле: без того и другого кнопка всё равно ничего бы не сделала.
 */
export function PodpislonSigningPanel({
  contractId,
  defaultName,
  defaultPhone,
  signatures,
}: {
  contractId: string
  defaultName: string | null
  defaultPhone: string | null
  signatures: PodpislonSignature[]
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)

  function submit(formData: FormData) {
    startTransition(async () => {
      const res = await sendContractToPodpislonAction(contractId, formData)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(res.message ?? 'Документ отправлен на подпись')
      setOpen(false)
    })
  }

  function refresh(signatureId: string) {
    setBusyId(signatureId)
    startTransition(async () => {
      const res = await refreshPodpislonStatusAction(signatureId)
      setBusyId(null)
      if (res.error) toast.error(res.error)
      else toast.success(res.message ?? 'Статус обновлён')
    })
  }

  function resend(signatureId: string) {
    setBusyId(signatureId)
    startTransition(async () => {
      const res = await resendPodpislonLinkAction(signatureId)
      setBusyId(null)
      if (res.error) toast.error(res.error)
      else toast.success(res.message ?? 'Ссылка отправлена повторно')
    })
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Ссылка скопирована')
    } catch {
      toast.error('Не удалось скопировать — откройте ссылку вручную')
    }
  }

  return (
    <div className="hp-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Signature className="w-4 h-4 text-[var(--hp-sub)]" />
          <h2 className="font-bold text-[var(--hp-ink)] text-[15px]">Подпись через Подпислон</h2>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-sm font-medium text-[var(--hp-sub)] hover:text-[var(--hp-ink)] transition-colors"
          >
            {signatures.length > 0 ? 'Отправить ещё раз' : 'Отправить на подпись'}
          </button>
        )}
      </div>

      {signatures.length === 0 && !open && (
        <p className="text-sm text-[var(--hp-sub)]">
          Клиент получит СМС с кодом и подпишет договор простой электронной подписью.
          К файлу автоматически подшиваются согласие на использование ПЭП и согласие
          на обработку персональных данных.
        </p>
      )}

      {signatures.length > 0 && (
        <div className="hp-block">
          {signatures.map((signature) => {
            const meta = STATUS_LABELS[signature.status] ?? STATUS_LABELS.pending
            const busy = busyId === signature.id && isPending
            return (
              <div key={signature.id} className="hp-block-row">
                <span className="label">
                  {signature.signer_name ?? signature.signer_phone ?? 'Подписант'}
                  <span className="block text-[11px] text-[var(--hp-tertiary)]">
                    {signature.signed_at
                      ? `подписано ${new Date(signature.signed_at).toLocaleString('ru-RU')}`
                      : `отправлено ${new Date(signature.created_at).toLocaleDateString('ru-RU')}`}
                  </span>
                </span>
                <span className="value flex items-center gap-2 flex-wrap">
                  <span className={meta.className}>{meta.label}</span>

                  {signature.signed_document_url && (
                    <a
                      href={signature.signed_document_url}
                      target="_blank"
                      rel="noreferrer"
                      title="Скачать подписанный PDF"
                      className="text-[var(--hp-sub)] hover:text-[var(--hp-ink)] transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  )}

                  {signature.sign_url && signature.status !== 'signed' && (
                    <button
                      type="button"
                      onClick={() => copyLink(signature.sign_url as string)}
                      title="Скопировать ссылку на подписание"
                      className="text-[var(--hp-sub)] hover:text-[var(--hp-ink)] transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {signature.status !== 'signed' && (
                    <button
                      type="button"
                      onClick={() => resend(signature.id)}
                      disabled={busy}
                      title="Переотправить клиенту ссылку"
                      className="text-[var(--hp-sub)] hover:text-[var(--hp-ink)] transition-colors disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => refresh(signature.id)}
                    disabled={busy}
                    title="Обновить статус из Подпислона"
                    className="text-[var(--hp-sub)] hover:text-[var(--hp-ink)] transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
                  </button>
                </span>
              </div>
            )
          })}
        </div>
      )}

      {open && (
        <form action={submit} className="space-y-3 border-t border-[var(--hp-border-soft)] pt-4">
          <div className="space-y-1.5">
            <label className="hp-label" htmlFor="podpislon-fio">ФИО подписанта</label>
            <input
              id="podpislon-fio"
              name="signer_full_name"
              defaultValue={defaultName ?? ''}
              placeholder="Иванов Иван Иванович"
              className="hp-input"
            />
          </div>
          <div className="space-y-1.5">
            <label className="hp-label" htmlFor="podpislon-phone">Телефон для СМС с кодом</label>
            <input
              id="podpislon-phone"
              name="signer_phone"
              defaultValue={defaultPhone ?? ''}
              placeholder="+7 999 123-45-67"
              className="hp-input"
            />
          </div>

          <label className="flex items-start gap-2 text-sm text-[var(--hp-sub)]">
            <input type="checkbox" name="without_sms" className="mt-0.5" />
            <span>
              Не отправлять СМС — получить ссылку и передать её клиенту самому
              (в мессенджере или лично)
            </span>
          </label>

          <p className="text-xs text-[var(--hp-tertiary)]">
            В отправляемый файл будут добавлены соглашение об использовании простой
            электронной подписи и согласие на обработку персональных данных.
          </p>

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
