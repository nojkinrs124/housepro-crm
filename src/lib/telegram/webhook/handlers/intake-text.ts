// Куда девать входящий текст, когда у пользователя открыта сессия «Занести в CRM».
// Вынесено из webhook/route.ts фазой 2 аудита без изменения поведения.

import { cancelIntake, attachNoteToIntake, runIntakeExtraction, getActiveIntake } from '@/lib/telegram/intake'
import type { BotActor } from '@/features/telegram/services/access'

export type IntakeSessionRow = NonNullable<Awaited<ReturnType<typeof getActiveIntake>>>

/** Сессия без типа живёт для текста только пока свежая: фото → «8912…» — одно
 * действие, а забытая утром сессия не должна глотать «какие задачи?» днём. */
const UNKNOWN_INTAKE_TEXT_WINDOW_MS = 10 * 60 * 1000

/**
 * Куда девать текст при открытой сессии «Занести в CRM». true — текст
 * забрала сессия; false — сессии нет или она не при делах, дальше обычный поток.
 */
export async function routeIntakeText(actor: BotActor, intake: IntakeSessionRow | null, text: string): Promise<boolean> {
  if (!intake || text.startsWith('/')) return false
  if (intake.kind === 'unknown') {
    if (Date.now() - new Date(intake.updated_at).getTime() > UNKNOWN_INTAKE_TEXT_WINDOW_MS) {
      await cancelIntake(intake, { silent: true })
      return false
    }
    await attachNoteToIntake(actor, intake, text)
    return true
  }
  if (intake.status === 'extracted') {
    await runIntakeExtraction(actor, intake.id, text)
  } else {
    await attachNoteToIntake(actor, intake, text)
  }
  return true
}
