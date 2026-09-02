import type { AvitoPropertyStatus } from '@/types/database'

const AVITO_STATUSES: AvitoPropertyStatus[] = ['pending', 'active', 'error', 'removed']

/**
 * Сужает `avito_status` из базы до известного статуса.
 *
 * В схеме колонка — обычный text без CHECK, туда может лечь что угодно, в том числе
 * новый статус из будущего ответа Авито. Неизвестное значение превращаем в null:
 * компоненты в этом случае показывают нейтральное «в обработке», а не падают на
 * поиске несуществующего ключа в STATUS_UI.
 *
 * Файл намеренно без 'use client' — его импортируют серверные страницы.
 */
export function toAvitoStatus(value: string | null | undefined): AvitoPropertyStatus | null {
  return AVITO_STATUSES.includes(value as AvitoPropertyStatus) ? (value as AvitoPropertyStatus) : null
}
