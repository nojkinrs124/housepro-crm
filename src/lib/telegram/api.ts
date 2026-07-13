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
  }
  callback_query?: {
    id: string
    data?: string
    from: { id: number; username?: string }
    message?: { message_id: number; chat: { id: number } }
  }
}
