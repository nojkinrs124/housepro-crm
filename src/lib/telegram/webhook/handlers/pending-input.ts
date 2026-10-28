// Одна дверь для «текста, которого бот сейчас ждёт».
//
// Было (находка аудита 28.10.2026): цепочку перехватчиков собирали ДВАЖДЫ —
// для текста в message.ts и, отдельной урезанной копией, для расшифровки
// голоса. Копии разошлись: голосом нельзя было ответить на форму «добавить
// пользователя» и на настройку расписания/рубрик, а приоритет открытой сессии
// «Занести в CRM» был противоположным (в голосе — первым, в тексте — после
// CRM-поиска). Один и тот же пользователь получал разное поведение в
// зависимости от того, набрал он текст или наговорил его.
//
// Теперь порядок задан ОДИН раз и одинаков для текста и голоса:
//
//   1. формы, открытые кнопкой (awaiting_intent): добавление допущенного,
//      поиск объекта/контакта, запись операции, часовой пояс, слот расписания,
//      промпт рубрики. Это самое конкретное состояние — кнопку нажали только что;
//   2. сессия «Занести в CRM»: заметка или поправка к показанной карточке.
//
// Правило на будущее: новый текст-перехватчик добавляется В ЭТОТ файл, в
// позицию, где он должен стоять по смыслу, а не в свой собственный вызов
// рядом с двумя копиями цепочки.

import type { BotActor } from '@/features/telegram/services/access'
import { tryHandleAddUserInput, tryHandleScheduleOrRubricInput } from './text-intents'
import { tryHandleCrmInput } from './crm-actions'
import { routeIntakeText, type IntakeSessionRow } from './intake-text'

export interface PendingInputOptions {
  /** Открытая сессия «Занести в CRM» (уже загружена вызывающим кодом). */
  intake: IntakeSessionRow | null
  /** Пересланное сообщение — источник контакта для формы «добавить пользователя». */
  forwardFromId?: number
  forwardFromName?: string
}

/**
 * Пробует отдать текст состояниям, которые его ждут.
 * true — ввод забран, дальше по общей цепочке его не передаём.
 */
export async function routePendingInput(
  actor: BotActor,
  text: string,
  opts: PendingInputOptions,
): Promise<boolean> {
  // Команды (/menu, /start, /pause) не должны глотаться «застрявшей» формой:
  // иначе после незавершённого добавления слота бот перестаёт отвечать на
  // команды, пока ввод случайно не распознается как невалидный ввод формы.
  if (text.startsWith('/')) return false

  if (await tryHandleAddUserInput(actor, text, opts.forwardFromId, opts.forwardFromName)) return true
  if (await tryHandleCrmInput(actor, text)) return true
  if (await tryHandleScheduleOrRubricInput(actor, text)) return true
  if (await routeIntakeText(actor, opts.intake, text)) return true

  return false
}
