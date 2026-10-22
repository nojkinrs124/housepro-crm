// Загрузка и сохранение истории диалога с моделью (bot_conversations).
// Вынесено из webhook/route.ts фазой 2 аудита без изменения поведения.

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { LlmContent, LlmMessage } from '@/lib/telegram/llm'
import { stripBinaryFromHistory, normalizeToolHistory } from '@/features/telegram/services/intake-format'

export type MessageContent = LlmContent
export type OpenRouterMessage = LlmMessage

// Сколько последних сообщений диалога храним и передаём модели (не считая system prompt).
export const MAX_HISTORY_MESSAGES = 20

export async function loadConversation(chatId: string): Promise<OpenRouterMessage[]> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data } = await supabaseAdmin
    .from('bot_conversations')
    .select('messages')
    .eq('telegram_chat_id', chatId)
    .maybeSingle()
  const raw = (data?.messages as OpenRouterMessage[] | undefined) ?? []
  // Старые записи могли сохраниться до починки normalizeToolHistory в saveConversation —
  // чиним и на чтении, иначе один раз сломанная история чата остаётся сломанной навсегда.
  return normalizeToolHistory(raw)
}

export async function saveConversation(chatId: string, orgId: string, messages: OpenRouterMessage[]): Promise<void> {
  // Без вложений: base64 фото и PDF в истории уходили модели на каждое сообщение.
  // normalizeToolHistory — следом, а не до среза: обрезка по MAX_HISTORY_MESSAGES
  // сама может отрезать историю ровно между assistant.tool_calls и его tool-ответом.
  const trimmed = normalizeToolHistory(stripBinaryFromHistory(messages.slice(-MAX_HISTORY_MESSAGES)))
  const supabaseAdmin = getSupabaseAdmin()
  await supabaseAdmin.from('bot_conversations').upsert({
    telegram_chat_id: chatId,
    organization_id: orgId,
    messages: trimmed,
    updated_at: new Date().toISOString(),
  })
}
