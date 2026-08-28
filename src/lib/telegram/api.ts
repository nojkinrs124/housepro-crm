// Тонкий клиент Telegram Bot API. Токен читается напрямую из process.env —
// НЕ добавлять в src/lib/env.ts через requireEnv() (тянется во все страницы,
// уронит билд при отсутствии ключа в окружениях, где бот не используется).

const TELEGRAM_API = 'https://api.telegram.org'

function botToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN не задан в окружении')
  return token
}

// Экранирует "<", ">", "&" везде, КРОМЕ трёх разрешённых тегов (<b> <i> <code> и их закрывающих
// пар). Без этого любой сырой текст — от модели, из БД, напечатанный вручную ("<тема поста>" и т.п.) —
// мог сломать HTML-парсинг Telegram ("can't parse entities") и уронить отправку целиком, особенно
// критично для sendPhoto/editMessageText, у которых (в отличие от sendMessage) нет ретрая без разметки.
const ALLOWED_TAG_RE = /<\/?(b|i|code)>/gi
function sanitizeTelegramHtml(text: string): string {
  const placeholders: string[] = []
  const protectedText = text.replace(ALLOWED_TAG_RE, (match) => {
    placeholders.push(match)
    return `\u0000${placeholders.length - 1}\u0000`
  })
  const escaped = protectedText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return escaped.replace(/\u0000(\d+)\u0000/g, (_, i) => placeholders[Number(i)] ?? '')
}

// callback_data — обычная кнопка, обрабатывается handleCallbackQuery в webhook.
// url — открывает ссылку прямо в Telegram (deep-линк на карточку в CRM и т.п.), не требует
// обработчика на нашей стороне. Ровно одно из двух полей на кнопку (как в Telegram Bot API).
export interface InlineKeyboardButton {
  text: string
  callback_data?: string
  url?: string
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
    text: sanitizeTelegramHtml(text),
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

export async function setWebhook(url: string, allowedUpdates: string[]): Promise<boolean> {
  const body: Record<string, unknown> = { url, allowed_updates: allowedUpdates }
  if (process.env.TELEGRAM_BOT_SECRET) body.secret_token = process.env.TELEGRAM_BOT_SECRET
  const res = await fetch(`${TELEGRAM_API}/bot${botToken()}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    console.error('[telegram] setWebhook failed:', await res.text())
    return false
  }
  return true
}

export async function setMyCommands(commands: { command: string; description: string }[]): Promise<boolean> {
  const res = await fetch(`${TELEGRAM_API}/bot${botToken()}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commands }),
  })
  if (!res.ok) {
    console.error('[telegram] setMyCommands failed:', await res.text())
    return false
  }
  return true
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

export async function sendChatAction(chatId: string | number, action: 'typing' | 'upload_document' | 'upload_photo' = 'typing'): Promise<void> {
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
  if (caption) body.caption = sanitizeTelegramHtml(caption)
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

/**
 * Перерисовывает текст (и опционально клавиатуру) уже отправленного сообщения —
 * основа "экрана" главного меню: одно сообщение, которое просто обновляется,
 * вместо потока новых сообщений на каждое нажатие.
 */
export async function editMessageText(
  chatId: string | number,
  messageId: number,
  text: string,
  opts?: { inlineKeyboard?: InlineKeyboardButton[][] | null }
): Promise<boolean> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text: sanitizeTelegramHtml(text),
    parse_mode: 'HTML',
  }
  if (opts?.inlineKeyboard !== undefined) {
    body.reply_markup = opts.inlineKeyboard ? { inline_keyboard: opts.inlineKeyboard } : undefined
  }
  const res = await fetch(`${TELEGRAM_API}/bot${botToken()}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    // Не критично: "message is not modified" — Telegram шлёт 400, если текст не изменился.
    const errText = await res.text()
    if (!errText.includes('message is not modified')) {
      console.error('[telegram] editMessageText failed:', errText)
    }
    return false
  }
  return true
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
    reply_to_message?: { message_id: number }
    forward_from?: { id: number; username?: string; first_name?: string }
  }
  message_reaction_count?: {
    chat: { id: number }
    message_id: number
    reactions: Array<{ type: { type: string; emoji?: string }; total_count: number }>
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
