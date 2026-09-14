'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, Copy, Loader2, RefreshCw, Sparkles, Square } from 'lucide-react'
import { QuickCreateModal } from '@/components/ui/QuickCreateModal'
import { saveListingTextAction } from '@/features/properties/actions/properties.actions'
import {
  LISTING_BODY_MAX,
  LISTING_TITLE_MAX,
  parseListingOutput,
  type ListingFact,
} from '@/lib/ai/listing/facts'

interface GenerateListingDialogProps {
  propertyId: string
  /** Факты из CRM, которые уйдут в промпт — показываем, чтобы было видно, что знает модель. */
  facts: ListingFact[]
  /** Вводные прошлой генерации — подставляются в поле, чтобы не диктовать заново. */
  initialRawInput: string
  onClose: () => void
}

type Phase = 'idle' | 'streaming' | 'done'

/**
 * Модалка генератора: сырые вводные → стрим текста из /api/ai/listing → сохранение.
 * Ответ модели приходит чистым текстом; заголовок и тело разбираем по первому `---`.
 * Закрытие окна или «Стоп» обрывают запрос через AbortController — сервер по cancel
 * стрима отменяет и запрос к модели.
 */
export function GenerateListingDialog({ propertyId, facts, initialRawInput, onClose }: GenerateListingDialogProps) {
  const router = useRouter()
  const [rawInput, setRawInput] = useState(initialRawInput)
  const [output, setOutput] = useState('')
  const [model, setModel] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
    return () => abortRef.current?.abort()
  }, [])

  const parsed = parseListingOutput(output)
  const hasResult = phase === 'done' && parsed.complete && parsed.body.length > 0
  const bodyTooLong = parsed.body.length > LISTING_BODY_MAX
  const titleTooLong = parsed.title.length > LISTING_TITLE_MAX

  function stop() {
    abortRef.current?.abort()
    abortRef.current = null
    setPhase(output ? 'done' : 'idle')
  }

  async function generate() {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setOutput('')
    setModel(null)
    setCopied(false)
    setPhase('streaming')

    try {
      const res = await fetch('/api/ai/listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, rawInput }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? `Ошибка генерации (${res.status})`)
      }
      setModel(res.headers.get('X-Listing-Model'))

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        setOutput(acc)
      }
      if (!acc.trim()) throw new Error('Модель вернула пустой ответ')
      setPhase('done')
    } catch (e) {
      if (controller.signal.aborted) return
      toast.error(e instanceof Error ? e.message : 'Ошибка генерации')
      setPhase('idle')
    } finally {
      if (abortRef.current === controller) abortRef.current = null
    }
  }

  async function copy() {
    const text = parsed.title ? `${parsed.title}\n\n${parsed.body}` : parsed.body
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Не удалось скопировать — скопируйте текст вручную')
    }
  }

  async function insert() {
    setSaving(true)
    const res = await saveListingTextAction(propertyId, {
      title: parsed.title,
      text: parsed.body,
      rawInput,
      model,
    })
    setSaving(false)
    if (res && 'error' in res && res.error) {
      toast.error(res.error)
      return
    }
    toast.success('Объявление сохранено')
    router.refresh()
    onClose()
  }

  return (
    <QuickCreateModal title="Сгенерировать объявление" onClose={onClose} size="lg">
      <div className="space-y-5">
        <div>
          <label className="hp-label" htmlFor="listing-raw-input">Сырые вводные</label>
          <textarea
            id="listing-raw-input"
            ref={textareaRef}
            value={rawInput}
            onChange={e => setRawInput(e.target.value)}
            disabled={phase === 'streaming'}
            rows={6}
            maxLength={8000}
            placeholder="Надиктуйте или вставьте заметки по квартире: состояние, мебель, техника, что рядом…"
            className="w-full px-4 py-3 border border-[var(--hp-border)] bg-[var(--hp-surface)] text-[var(--hp-ink)] text-sm outline-none focus:border-[var(--hp-ink)] resize-y disabled:opacity-60"
          />
          <p className="text-xs text-[var(--hp-tertiary)] mt-1">{rawInput.length} / 8000</p>
        </div>

        <details className="hp-block">
          <summary className="hp-block-header cursor-pointer select-none">
            Данные из CRM, которые уйдут в промпт ({facts.length})
          </summary>
          {facts.length === 0 ? (
            <div className="hp-block-row"><span className="label">В карточке объекта ничего не заполнено — модель будет опираться только на вводные</span></div>
          ) : facts.map(f => (
            <div key={f.label} className="hp-block-row">
              <span className="label">{f.label}</span>
              <span className="value whitespace-pre-wrap break-words">{f.value}</span>
            </div>
          ))}
        </details>

        <div className="flex flex-wrap gap-2 shrink-0">
          {phase === 'streaming' ? (
            <button type="button" onClick={stop} className="hp-btn-secondary">
              <Square style={{ width: 14, height: 14 }} />
              Стоп
            </button>
          ) : (
            <button type="button" onClick={generate} className="hp-btn-primary">
              {hasResult ? <RefreshCw style={{ width: 14, height: 14 }} /> : <Sparkles style={{ width: 14, height: 14 }} />}
              {hasResult ? 'Перегенерировать' : 'Сгенерировать'}
            </button>
          )}
        </div>

        {(output || phase === 'streaming') && (
          <div className="space-y-3">
            <div className="hp-block">
              <div className="hp-block-header flex items-center justify-between gap-3 flex-wrap">
                <span>Результат</span>
                <span className="flex items-center gap-2 text-xs font-normal">
                  {phase === 'streaming' && <Loader2 className="animate-spin" style={{ width: 12, height: 12 }} />}
                  <span className={`hp-badge ${titleTooLong ? 'hp-badge-warn' : 'hp-badge-neutral'}`}>
                    заголовок {parsed.title.length} / {LISTING_TITLE_MAX}
                  </span>
                  <span className={`hp-badge ${bodyTooLong ? 'hp-badge-warn' : 'hp-badge-neutral'}`}>
                    тело {parsed.body.length} / {LISTING_BODY_MAX}
                  </span>
                </span>
              </div>
              <div className="px-4 py-3 space-y-3">
                {parsed.title && (
                  <p className="font-semibold text-[var(--hp-ink)]">{parsed.title}</p>
                )}
                <p className="text-sm text-[var(--hp-ink)] leading-relaxed whitespace-pre-wrap break-words min-h-[3rem]">
                  {parsed.body}
                </p>
              </div>
            </div>
            {bodyTooLong && (
              <p className="text-xs text-[var(--hp-warn)]">
                Тело длиннее {LISTING_BODY_MAX} символов — Авито обрежет текст. Перегенерируйте или сократите вводные.
              </p>
            )}

            {hasResult && (
              <div className="flex flex-wrap gap-2 shrink-0">
                <button type="button" onClick={insert} disabled={saving} className="hp-btn-primary disabled:opacity-50">
                  {saving ? <Loader2 className="animate-spin" style={{ width: 14, height: 14 }} /> : <Check style={{ width: 14, height: 14 }} />}
                  Вставить в объявление
                </button>
                <button type="button" onClick={copy} className="hp-btn-secondary">
                  {copied ? <Check style={{ width: 14, height: 14 }} /> : <Copy style={{ width: 14, height: 14 }} />}
                  {copied ? 'Скопировано' : 'Копировать'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </QuickCreateModal>
  )
}
