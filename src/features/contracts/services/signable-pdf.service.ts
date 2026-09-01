// Файл, который уходит клиенту на подпись.
//
// Требование бизнеса: в одном файле с договором должны быть согласие на
// использование простой электронной подписи и согласие на обработку
// персональных данных. Именно в одном — тогда клиент подписывает всё это
// единым кодом, и не возникает вопроса «а согласие он подписывал?».
//
// Подпислон принимает только PDF, а договоры формируются в DOCX по шаблону
// агентства, поэтому здесь же живёт превращение DOCX в PDF (см. lib/pdf).

import { extractTextFromDocx } from '@/lib/telegram/docx-reader'
import { consentPagesBlocks, SIGNING_CONSENT_VERSION, type ConsentContext } from '@/lib/pdf/consents'
import { mergePdfs, renderTextPdf, type PdfBlock } from '@/lib/pdf/text-pdf'

export { SIGNING_CONSENT_VERSION }
export type { ConsentContext }

/** PDF начинается с этой сигнатуры — по ней отличаем готовый PDF от DOCX. */
export function isPdf(buffer: Buffer): boolean {
  return buffer.subarray(0, 5).toString('latin1') === '%PDF-'
}

/** Абзацы договора из DOCX — в блоки для рендера. */
function contractBlocks(docxText: string, title: string): PdfBlock[] {
  const blocks: PdfBlock[] = [{ text: title, style: 'title', align: 'center' }]

  for (const line of docxText.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) {
      blocks.push({ text: '' })
      continue
    }
    // Короткая строка в верхнем регистре — это заголовок раздела договора,
    // а не абзац: набираем жирным, иначе документ читается сплошняком.
    const isHeading = trimmed.length <= 90 && trimmed === trimmed.toUpperCase() && /[А-ЯЁA-Z]/.test(trimmed)
    blocks.push({ text: trimmed, style: isHeading ? 'heading' : 'body' })
  }

  return blocks
}

export interface SignablePdfParams {
  /** Исходный файл договора: DOCX из генератора или уже готовый PDF. */
  source: Buffer
  /** Заголовок для первой страницы, если верстаем PDF из DOCX. */
  title: string
  consent: ConsentContext
}

/**
 * Собирает PDF «договор + два согласия».
 *
 * Если исходник уже PDF (агентство загрузило подписанный макет или скан),
 * его страницы сохраняются как есть, а согласия подшиваются в конец — так
 * не теряется оформление документа, которое клиент и увидит.
 */
export async function buildSignablePdf(params: SignablePdfParams): Promise<Buffer> {
  const consents = consentPagesBlocks(params.consent)

  if (isPdf(params.source)) {
    const consentPdf = await renderTextPdf(consents)
    return mergePdfs([params.source, consentPdf])
  }

  const text = extractTextFromDocx(params.source)
  return renderTextPdf([...contractBlocks(text, params.title), ...consents])
}
