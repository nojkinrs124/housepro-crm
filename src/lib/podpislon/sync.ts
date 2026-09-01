// Синхронизация статуса подписания с Подпислоном.
//
// Один код на два вызова: вебхук сервиса и кнопку «Обновить статус» в карточке
// договора. Вебхуку доверять на слово нельзя — в его теле есть поле SIGNATURE,
// но алгоритм её вычисления сервис не публикует, поэтому проверить подпись
// запроса нечем. Поступаем как с уведомлениями ЮKassa: адрес вебхука закрыт
// секретом организации, а сам факт подписания подтверждаем обратным запросом
// к API по ключу. Так подделанный вебхук не может пометить договор подписанным.

import type { SupabaseClient } from '@supabase/supabase-js'
import { getDocuments, getSignedFile, mapPodpislonStatus, PODPISLON_STATUS } from './api'
import { uploadContractFile } from '@/features/contracts/services/document.service'

export interface SignatureRow {
  id: string
  contract_id: string
  organization_id: string
  status: string
  external_id: string | null
  external_package_id: string | null
  sign_url: string | null
  signed_document_url: string | null
}

export interface SyncResult {
  status: string
  changed: boolean
  signUrl?: string | null
}

/**
 * Забирает актуальный статус документа и приводит к нему нашу запись.
 *
 * Подписанный PDF выгружаем себе в хранилище сразу: у сервиса свой срок
 * хранения и свой тариф, а подписанный договор должен остаться у агентства
 * даже после отключения интеграции.
 */
export async function syncPodpislonSignature(
  supabase: SupabaseClient,
  apiKey: string,
  signature: SignatureRow
): Promise<SyncResult> {
  if (!signature.external_id) return { status: signature.status, changed: false }

  const documents = await getDocuments(apiKey, [Number(signature.external_id)])
  const document = documents.find((d) => String(d.id) === signature.external_id) ?? documents[0]
  if (!document) return { status: signature.status, changed: false }

  const status = mapPodpislonStatus(document.status)
  const link = document.contacts?.[0]?.link ?? document.contact?.link ?? signature.sign_url

  const update: Record<string, unknown> = {
    provider_status: document.status ?? null,
    sign_url: link ?? null,
  }
  if (document.package && !signature.external_package_id) update.external_package_id = document.package

  const wasSigned = signature.status === 'signed'

  if (status !== signature.status) {
    update.status = status
    if (status === 'viewed') update.opened_at = new Date().toISOString()
    if (status === 'signed') update.signed_at = new Date().toISOString()
  }

  // Подписанный файл забираем один раз — повторные вебхуки не должны
  // перезаписывать хранилище и плодить версии договора.
  if (document.status === PODPISLON_STATUS.signed && !signature.signed_document_url) {
    try {
      const file = await getSignedFile(apiKey, Number(signature.external_id))
      update.signed_document_url = await uploadContractFile(
        signature.contract_id,
        file,
        'contract-signed.pdf',
        'application/pdf',
        supabase
      )
    } catch (e) {
      // Статус важнее файла: если выгрузка не удалась, статус всё равно
      // обновится, а файл дотянет следующий вызов синхронизации.
      console.error('[podpislon] не удалось выгрузить подписанный файл:', e)
    }
  }

  await supabase.from('contract_signatures').update(update).eq('id', signature.id)

  if (status === 'signed' && !wasSigned) {
    await supabase
      .from('contracts')
      .update({ status: 'signed' })
      .eq('id', signature.contract_id)
      .eq('organization_id', signature.organization_id)
  }

  return { status, changed: status !== signature.status, signUrl: link }
}
