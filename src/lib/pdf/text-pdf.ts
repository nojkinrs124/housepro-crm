// Сборка PDF из текста — минимальная вёрстка: A4, поля, переносы, нумерация.
//
// Зачем вообще свой рендер: Подпислон принимает на подпись только PDF, а
// договоры в CRM формируются в DOCX по шаблону агентства. Конвертировать
// DOCX → PDF «как в Word» без LibreOffice на сервере невозможно, а тащить
// LibreOffice в serverless-функцию нельзя. Поэтому берём из DOCX текст
// (lib/telegram/docx-reader) и печатаем его этим рендером: содержание
// документа сохраняется полностью, сложное оформление — нет.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { PT_SANS_BOLD_BASE64, PT_SANS_REGULAR_BASE64 } from './fonts'

export type BlockStyle = 'title' | 'heading' | 'body' | 'small'

export interface PdfBlock {
  text?: string
  style?: BlockStyle
  align?: 'left' | 'center'
  /** Начать новую страницу перед блоком. */
  pageBreak?: boolean
}

const PAGE_WIDTH = 595.28 // A4 в пунктах
const PAGE_HEIGHT = 841.89
const MARGIN_X = 56
const MARGIN_TOP = 56
const MARGIN_BOTTOM = 52

const STYLES: Record<BlockStyle, { size: number; bold: boolean; lead: number; spaceAfter: number }> = {
  title: { size: 13, bold: true, lead: 1.35, spaceAfter: 12 },
  heading: { size: 11, bold: true, lead: 1.35, spaceAfter: 6 },
  body: { size: 10, bold: false, lead: 1.4, spaceAfter: 6 },
  small: { size: 8.5, bold: false, lead: 1.4, spaceAfter: 4 },
}

/**
 * Оставляет только символы, которые есть в урезанном шрифте.
 *
 * pdf-lib падает на символе без глифа, а текст приходит из шаблона агентства —
 * там может оказаться что угодно, вплоть до эмодзи. Терять один знак лучше,
 * чем не отправить договор на подпись.
 */
export function sanitizeForPdf(input: string): string {
  const replacements: Record<string, string> = {
    '\t': '    ',
    '\u00a0': ' ', // неразрывный пробел — в шаблонах договоров он встречается постоянно
    '\u202f': ' ',
    '\u200b': '',
    '\u2028': '\n',
    '\u2029': '\n',
    '\u2122': 'TM',
  }

  return Array.from(input.replace(/\r\n?/g, '\n'))
    .map((char) => {
      if (replacements[char] !== undefined) return replacements[char]
      if (char === '\n') return char
      const code = char.codePointAt(0) ?? 0
      const supported =
        (code >= 0x20 && code <= 0x7e) ||
        (code >= 0x0410 && code <= 0x044f) ||
        code === 0x0401 || code === 0x0451 ||
        code === 0x00a9 || code === 0x00ab || code === 0x00bb ||
        code === 0x00b0 || code === 0x00b7 || code === 0x00d7 ||
        (code >= 0x2010 && code <= 0x2015) ||
        (code >= 0x2018 && code <= 0x201f) ||
        (code >= 0x2020 && code <= 0x2022) ||
        code === 0x2026 || code === 0x2030 || code === 0x2039 || code === 0x203a ||
        code === 0x20bd || code === 0x2116 || code === 0x2212
      return supported ? char : ' '
    })
    .join('')
}

/** Разбивает абзац на строки по ширине колонки. */
function wrapLine(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']

  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate
      continue
    }
    if (current) lines.push(current)
    // Слово длиннее строки (длинный номер счёта, ссылка) — режем посимвольно.
    if (font.widthOfTextAtSize(word, size) > maxWidth) {
      let chunk = ''
      for (const char of word) {
        if (font.widthOfTextAtSize(chunk + char, size) > maxWidth) {
          lines.push(chunk)
          chunk = char
        } else {
          chunk += char
        }
      }
      current = chunk
    } else {
      current = word
    }
  }

  if (current) lines.push(current)
  return lines
}

/** Рендерит блоки в новый PDF-документ. */
export async function renderTextPdf(blocks: PdfBlock[]): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)

  // Шрифт передаём строкой base64: pdf-lib проверяет тип через instanceof, а
  // Buffer из Node в других реалмах (jsdom в тестах) эту проверку не проходит.
  const regular = await pdf.embedFont(PT_SANS_REGULAR_BASE64, { subset: true })
  const bold = await pdf.embedFont(PT_SANS_BOLD_BASE64, { subset: true })

  const contentWidth = PAGE_WIDTH - MARGIN_X * 2
  let page: PDFPage = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let cursor = PAGE_HEIGHT - MARGIN_TOP

  // Пустая ли текущая страница — нужно, чтобы pageBreak не плодил пустые листы,
  // когда согласия и так начинаются с чистой страницы.
  let pageIsEmpty = true

  const newPage = () => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    cursor = PAGE_HEIGHT - MARGIN_TOP
    pageIsEmpty = true
  }

  for (const block of blocks) {
    const style = STYLES[block.style ?? 'body']
    const font = style.bold ? bold : regular
    const lineHeight = style.size * style.lead

    if (block.pageBreak && !pageIsEmpty) newPage()

    const raw = sanitizeForPdf(block.text ?? '')
    // Пустой блок — вертикальный отступ, без него текст договора слипается.
    if (raw.trim() === '') {
      cursor -= lineHeight
      continue
    }

    for (const paragraph of raw.split('\n')) {
      const lines = wrapLine(paragraph, font, style.size, contentWidth)
      for (const line of lines) {
        if (cursor - lineHeight < MARGIN_BOTTOM) newPage()
        const width = font.widthOfTextAtSize(line, style.size)
        const x = block.align === 'center' ? (PAGE_WIDTH - width) / 2 : MARGIN_X
        page.drawText(line, {
          x,
          y: cursor - style.size,
          size: style.size,
          font,
          color: rgb(0.08, 0.1, 0.09),
        })
        cursor -= lineHeight
        pageIsEmpty = false
      }
    }

    cursor -= style.spaceAfter
  }

  // Нумерация страниц: подписант должен видеть, что документ не обрезан.
  const pages = pdf.getPages()
  const footer = await pdf.embedFont(StandardFonts.Helvetica)
  pages.forEach((current, index) => {
    const label = `${index + 1} / ${pages.length}`
    const width = footer.widthOfTextAtSize(label, 8)
    current.drawText(label, {
      x: (PAGE_WIDTH - width) / 2,
      y: MARGIN_BOTTOM - 24,
      size: 8,
      font: footer,
      color: rgb(0.45, 0.48, 0.44),
    })
  })

  return Buffer.from(await pdf.save())
}

/** Склеивает несколько PDF в один — договор плюс страницы согласий. */
export async function mergePdfs(parts: Buffer[]): Promise<Buffer> {
  const merged = await PDFDocument.create()
  for (const part of parts) {
    // См. комментарий про instanceof выше — Buffer приводим к «местному» Uint8Array.
    const source = await PDFDocument.load(Uint8Array.from(part))
    const pages = await merged.copyPages(source, source.getPageIndices())
    pages.forEach((page) => merged.addPage(page))
  }
  return Buffer.from(await merged.save())
}
