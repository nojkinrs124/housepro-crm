// Обработка update.message: голос/фото/документ/текст — одна дверь на все виды
// сообщений, допуск проверяется один раз, до скачивания файлов и платной
// расшифровки голоса. Вынесено из webhook/route.ts фазой 2 аудита без
// изменения поведения.

import type { TelegramUpdate } from '@/lib/telegram/api'
import { sendMessage, downloadTelegramFile } from '@/lib/telegram/api'
import { transcribeAudio } from '@/lib/telegram/stt'
import { getActiveIntake, attachFileToIntake } from '@/lib/telegram/intake'
import { setAwaitingIntent } from '@/lib/telegram/channel'
import { resolveActor } from '@/lib/telegram/webhook/context'
import { HELP_TEXT } from '@/lib/telegram/webhook/dialog/prompts'
import { handleUserTurn } from '@/lib/telegram/webhook/dialog/turn'
import { sendMainMenu } from '@/lib/telegram/webhook/handlers/menu'
import { tryHandleChannelInput } from '@/lib/telegram/webhook/handlers/channel-content'
import { routePendingInput } from '@/lib/telegram/webhook/handlers/pending-input'
import { canRunCommand } from '@/features/telegram/services/access'

async function denyStranger(chatId: number): Promise<void> {
  await sendMessage(chatId, '⛔ Этот аккаунт не имеет доступа к боту.')
}

export async function handleMessage(message: NonNullable<TelegramUpdate['message']>): Promise<void> {
  const chatId = message.chat.id

  // Одна дверь на все виды сообщений: текст, голос, фото, документ. Раньше
  // допуск проверялся внутри handleUserTurn, то есть уже ПОСЛЕ скачивания
  // файла и расшифровки голоса — посторонний мог заставить бота качать
  // файлы и звать платную расшифровку, не имея доступа ни к чему.
  const actor = await resolveActor(String(message.from?.id ?? chatId), chatId, message.from?.username)
  if (!actor) {
    await sendMessage(chatId, '⚠️ Бот не настроен: не найден рабочий API-ключ (HOUSEPRO_BOT_API_KEY).')
    return
  }
  if (actor.role === 'stranger') {
    await denyStranger(chatId)
    return
  }

  // Открытая сессия «Занести в CRM»: текст и голос — заметки к документам
  // (телефон, пожелания) или поправка к показанной карточке; модель не вызывается.
  const intake = await getActiveIntake(actor.telegramUserId)

  if (message.voice) {
    const { base64 } = await downloadTelegramFile(message.voice.file_id)
    const transcript = await transcribeAudio(base64, 'ogg')
    // Расшифровку показываем всегда: иначе ошибка распознавания (имя, сумма,
    // номер) уходит дальше молча и всплывает только в подтверждении действия.
    await sendMessage(chatId, `🎤 <i>${transcript}</i>`)
    // Дальше — ровно тот же путь, что у набранного текста: те же формы, та же
    // сессия «Занести в CRM», тот же диалог. Раньше здесь была отдельная
    // урезанная копия цепочки, и голосом нельзя было ответить на половину кнопок.
    const handled = await routePendingInput(actor, transcript, {
      intake,
      forwardFromId: message.forward_from?.id,
      forwardFromName: message.forward_from?.first_name || message.forward_from?.username,
    })
    if (!handled && !(await tryHandleChannelInput(actor, transcript, message.reply_to_message?.message_id))) {
      // Голосом отвечают на те же кнопки, что и текстом: «найди Иванова»,
      // «расход пять тысяч бензин».
      await handleUserTurn(actor, transcript)
    }
    return
  }

  if (message.photo && message.photo.length > 0) {
    const largestPhoto = message.photo[message.photo.length - 1]
    await attachFileToIntake(actor, {
      fileId: largestPhoto.file_id,
      source: 'photo',
      mediaGroupId: message.media_group_id,
      caption: message.caption,
    })
    return
  }

  if (message.document) {
    const doc = message.document
    const fileName = doc.file_name ?? 'document'
    const lower = fileName.toLowerCase()
    const isPdf = doc.mime_type === 'application/pdf' || lower.endsWith('.pdf')
    const isDocx = lower.endsWith('.docx')
    const isImage = /^image\/(jpeg|png|webp)$/.test(doc.mime_type ?? '') || /\.(jpe?g|png|webp)$/.test(lower)
    if (!isPdf && !isDocx && !isImage) {
      await sendMessage(chatId, '⚠️ Понимаю PDF, DOCX и картинки (JPG/PNG). Пришли документ в одном из этих форматов.')
    } else {
      await attachFileToIntake(actor, {
        fileId: doc.file_id,
        source: 'document',
        fileName,
        mimeType: isPdf ? 'application/pdf' : isDocx ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : doc.mime_type,
        fileSize: doc.file_size,
        mediaGroupId: message.media_group_id,
        caption: message.caption,
      })
    }
    return
  }

  if (message.text) {
    const text = message.text.trim()
    const forwardFrom = message.forward_from

    if (text === '/start' || text === '/help') {
      await sendMessage(chatId, HELP_TEXT)
      await sendMainMenu(actor)
    } else if (text === '/repair_cta') {
      // Разовая починка постов канала, вышедших с тегом <a href> текстом (см. channel.ts).
      if (!canRunCommand(actor.role, 'repair_cta')) {
        const { denyAdmin } = await import('@/lib/telegram/webhook/context')
        await denyAdmin(chatId)
      } else {
        const { repairPublishedCtaLinks } = await import('@/lib/telegram/channel')
        const r = await repairPublishedCtaLinks(actor.orgId)
        await sendMessage(chatId, r.total
          ? `🔧 Постов с тегом: ${r.total}. Исправлено: ${r.fixed}${r.failed ? `, не удалось: ${r.failed} (см. логи)` : ''}.`
          : '🔧 Постов с тегом в канале не найдено.')
      }
    } else if (text === '/menu') {
      // Общая команда, а не часть контент-модуля канала: сотруднику меню
      // тоже нужно — просто в нём меньше разделов.
      if (actor.role === 'admin') await setAwaitingIntent(actor.orgId, null)
      await sendMainMenu(actor)
    } else {
      // Формы и сессия «Занести в CRM» — в одном месте и в одном порядке,
      // общем с голосом (pending-input.ts).
      const handled = await routePendingInput(actor, text, {
        intake,
        forwardFromId: forwardFrom?.id,
        forwardFromName: forwardFrom?.first_name || forwardFrom?.username,
      })
      if (!handled && !(await tryHandleChannelInput(actor, text, message.reply_to_message?.message_id))) {
        await handleUserTurn(actor, text)
      }
    }
  }
}
