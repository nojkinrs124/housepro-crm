'use client'

import { FileText } from 'lucide-react'
import { ANALYTICS_EVENTS, analyticsAttrs } from '../analytics'
import { DOCUMENT_SAMPLES } from '../config'
import { requestLead } from '../lead-context-store'

/**
 * Экран 6 страницы «Сдать квартиру» — «Документы».
 *
 * Тексты — дословно из docs/uslugi/sdat-kvartiru-texts.md, список документов —
 * `DOCUMENT_SAMPLES` из config.ts. Пока у документа нет `sampleUrl`, кнопка
 * превращается в «Запросить образец» и уводит в форму заявки с контекстом
 * документа (`requestLead`) — поэтому файл клиентский.
 */

interface Props {
  /** id секции для якорных ссылок */
  id?: string
}

export function DocumentSamples({ id }: Props) {
  return (
    <section id={id} className="scroll-mt-20 pt-16 sm:pt-20">
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6">
        <h2 className="text-[22px] sm:text-[26px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
          Посмотрите документы до того, как что-то подписывать
        </h2>
        <p className="mt-2 text-[14px] sm:text-[15px] leading-relaxed max-w-[640px]" style={{ color: 'var(--hp-sub)' }}>
          Три документа, которые вы получите. Открываются прямо здесь, обезличенные — без данных реальных
          клиентов.
        </p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch">
          {DOCUMENT_SAMPLES.map(doc => {
            const attrs = analyticsAttrs(ANALYTICS_EVENTS.documentSample, { document: doc.id })
            return (
              <article
                key={doc.id}
                className="p-5 sm:p-6 flex flex-col h-full border"
                style={{
                  background: 'var(--hp-surface)',
                  borderColor: 'var(--hp-border)',
                  borderRadius: 'var(--hp-radius)',
                }}
              >
                <div
                  className="inline-flex items-center justify-center w-10 h-10"
                  style={{ background: 'var(--hp-accent-tint)', borderRadius: 'var(--hp-radius)' }}
                >
                  <FileText aria-hidden="true" style={{ width: 20, height: 20, color: 'var(--hp-accent)' }} />
                </div>

                <h3 className="mt-4 text-[17px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
                  {doc.title}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed" style={{ color: 'var(--hp-sub)' }}>
                  {doc.description}
                </p>

                <div className="mt-auto pt-6">
                  {doc.sampleUrl ? (
                    <a
                      href={doc.sampleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hp-btn-secondary h-11 justify-center w-full"
                      {...attrs}
                    >
                      Посмотреть образец
                    </a>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="hp-btn-secondary h-11 justify-center w-full"
                        onClick={() => requestLead({ intent: 'document_sample', documentId: doc.id })}
                        {...attrs}
                      >
                        Запросить образец
                      </button>
                      <p className="mt-2 text-[12px] leading-relaxed" style={{ color: 'var(--hp-tertiary)' }}>
                        Пришлём обезличенный образец в ответ на заявку
                      </p>
                    </>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
