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

export async function sendMessage(
  chatId: string | number,
  text: string,
  opts?: { inlineKeyboard?: InlineKeyboardButton[][] }
): Promise<void> {
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
    console.error('[telegram] sendMessage failed:', await res.text())
  }
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
    'application/octet-stream'

  return { base64, mimeType }
}
