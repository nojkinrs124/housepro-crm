// Тонкий клиент Telegram Bot API. Токен читается напрямую из process.env —
// НЕ добавлять в src/lib/env.ts через requireEnv() (тянется во все страницы,
// уронит билд при отсутствии ключа в окружениях, где бот не используется).

const TELEGRAM_API = 'https://api.telegram.org'

function botToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN не задан в окружении')
  return token
}

export interface InlineKeyboardButton {
  text: string
  callback_data: string
}

export interface SendMessageResult {
  result?: { message_id?: number }
}

// Возвращаемое значение — расширение (было Promise<void>): существующие вызовы,
// игнорирующие результат, продолжают работать без изменений.
export async function sendMessage(
  chatId: string | number,
  text: string,
  opts?: { inlineKeyboard?: InlineKeyboardButton[][] }
): Promise<SendMessageResult | void> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  }
  if (opts?.inlineKeyboard) {
    body.reply_markup = { inline_keyboard: opts.inlineKeyboard }
  }

  const res = await fetch(`${TELEGRAM_API}/bot${botToken()}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error('[telegram] sendMessage failed:', errText)
    // Модель иногда выдаёт текст с "<"/">"/"&", ломающими HTML-парсинг Telegram
    // (ошибка вида "can't parse entities"). Не роняем сообщение целиком — шлём тем же
    // текстом, но без разметки, лучше без форматирования, чем вообще без ответа.
    if (errText.includes("can't parse entities") || errText.includes('parse entities')) {
      const retryRes = await fetch(`${TELEGRAM_API}/bot${botToken()}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, reply_markup: body.reply_markup }),
      })
      if (!retryRes.ok) console.error('[telegram] sendMessage plain-text retry failed:', await retryRes.text())
      else return retryRes.json().catch(() => undefined)
    }
    return undefined
  }

  return res.json().catch(() => undefined)
}

/** Число участников чата/канала — используется для еженедельной сводки. */
export async function getChatMemberCount(chatId: string | number): Promise<number | null> {
  const res = await fetch(`${TELEGRAM_API}/bot${botToken()}/getChatMemberCount?chat_id=${encodeURIComponent(String(chatId))}`)
  if (!res.ok) {
    console.error('[telegram] getChatMemberCount failed:', await res.text())
    return null
  }
  const data = await res.json().catch(() => null)
  return typeof data?.result === 'number' ? data.result : null
}

export async function sendChatAction(chatId: string | number, action: 'typing' | 'upload_document' = 'typing'): Promise<void> {
  await fetch(`${TELEGRAM_API}/bot${botToken()}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action }),
  }).catch(() => {}) // индикатор — не критично, если не отправился
}

/** Отправляет файл по прямой ссылке (например, подписанный Storage URL) — Telegram сам его скачает. */
/** Отправляет фото по прямой ссылке (Storage public URL) с опциональной подписью и клавиатурой. */
export async function sendPhoto(
  chatId: string | number,
  photoUrl: string,
  caption?: string,
  opts?: { inlineKeyboard?: InlineKeyboardButton[][] }
): Promise<SendMessageResult | void> {
  const body: Record<string, unknown> = { chat_id: chatId, photo: photoUrl, parse_mode: 'HTML' }
  if (caption) body.caption = caption
  if (opts?.inlineKeyboard) body.reply_markup = { inline_keyboard: opts.inlineKeyboard }

  const res = await fetch(`${TELEGRAM_API}/bot${botToken()}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    console.error('[telegram] sendPhoto failed:', await res.text())
    return undefined
  }
  return res.json().catch(() => undefined)
}

export async function sendDocument(chatId: string | number, documentUrl: string, caption?: string): Promise<void> {
  const res = await fetch(`${TELEGRAM_API}/bot${botToken()}/sendDocument`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, document: documentUrl, caption }),
  })
  if (!res.ok) console.error('[telegram] sendDocument failed:', await res.text())
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  await fetch(`${TELEGRAM_API}/bot${botToken()}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  })
}

export async function editMessageReplyMarkup(
  chatId: string | number,
  messageId: number,
  inlineKeyboard: InlineKeyboardButton[][] | null
): Promise<void> {
  await fetch(`${TELEGRAM_API}/bot${botToken()}/editMessageReplyMarkup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      reply_markup: inlineKeyboard ? { inline_keyboard: inlineKeyboard } : undefined,
    }),
  })
}

// Минимальные типы для того, что реально парсим из Telegram Update
export interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    chat: { id: number }
    from?: { id: number; username?: string }
    text?: string
    caption?: string
    voice?: { file_id: string; duration: number; mime_type?: string }
    photo?: Array<{ file_id: string; width: number; height: number }>
    document?: { file_id: string; file_name?: string; mime_type?: string; file_size?: number }
  }
  callback_query?: {
    id: string
    data?: string
    from: { id: number; username?: string }
    message?: { message_id: number; chat: { id: number } }
  }
}

/**
 * Скачивает файл по file_id (голосовое сообщение или фото) и возвращает его
 * содержимое в base64 + mime type. Используется для распознавания речи и анализа фото.
 */
export async function downloadTelegramFile(fileId: string): Promise<{ base64: string; mimeType: string }> {
  const fileInfoRes = await fetch(`${TELEGRAM_API}/bot${botToken()}/getFile?file_id=${fileId}`)
  const fileInfo = await fileInfoRes.json()
  const filePath: string | undefined = fileInfo?.result?.file_path
  if (!filePath) throw new Error('Не удалось получить file_path от Telegram')

  const fileRes = await fetch(`${TELEGRAM_API}/file/bot${botToken()}/${filePath}`)
  if (!fileRes.ok) throw new Error(`Не удалось скачать файл: HTTP ${fileRes.status}`)

  const arrayBuffer = await fileRes.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')

  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  const mimeType =
    ext === 'oga' || ext === 'ogg' ? 'audio/ogg' :
    ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
    ext === 'png' ? 'image/png' :
    ext === 'webp' ? 'image/webp' :
    ext === 'pdf' ? 'application/pdf' :
    ext === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
    'application/octet-stream'

  return { base64, mimeType }
}
