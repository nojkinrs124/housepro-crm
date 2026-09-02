'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSessionContext, requireOrgId } from '@/lib/org'
import { requirePermission } from '@/lib/permissions'
import { rateLimitMutation } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'
import { consentFields } from '@/lib/consent'
import { hashDocument, generateSignToken } from '@/lib/signing'
import { getSiteUrl } from '@/lib/telegram/site-url'
import {
  addDocument,
  getCompanyInfo,
  normalizePhone,
  PodpislonError,
  resendPackage,
} from '@/lib/podpislon/api'
import { getPodpislonSettings } from '@/lib/podpislon/credentials'
import { syncPodpislonSignature, type SignatureRow } from '@/lib/podpislon/sync'
import { buildContractVariables, uploadContractFile } from '../services/document.service'
import { buildSignablePdf, SIGNING_CONSENT_VERSION } from '../services/signable-pdf.service'
import { CONTRACT_TYPE_MAP } from '../config/contract-types'

export interface PodpislonActionResult {
  error?: string
  success?: boolean
  message?: string
  /** Персональная ссылка на подписание — показываем менеджеру. */
  signUrl?: string | null
}

/** «Иванов Иван Иванович» → фамилия / имя / отчество. */
function splitFio(fullName: string): { lastName: string; name: string; secondName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  return {
    lastName: parts[0] ?? '',
    name: parts[1] ?? '',
    secondName: parts.slice(2).join(' '),
  }
}

interface ContractRow {
  id: string
  contract_number: string | null
  contract_type: string | null
  generated_docx_url: string | null
  organization_id: string
  client_contact_id: string | null
  client_contact: { id: string; full_name: string | null; phone: string | null } | null
}

/**
 * Отправляет договор на подпись через Подпислон.
 *
 * К файлу договора здесь же подшиваются согласие на использование простой
 * электронной подписи и согласие на обработку персональных данных — клиент
 * подписывает всё одним кодом из СМС (см. services/signable-pdf.service).
 */
export async function sendContractToPodpislonAction(
  contractId: string,
  formData: FormData
): Promise<PodpislonActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const rl = await rateLimitMutation(user.id, 'podpislon_send')
  if (!rl.success) return { error: 'Слишком много запросов. Подождите минуту.' }

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const permError = await requirePermission(user.id, 'contracts', 'update')
  if (permError) return { error: permError.error }

  const settings = await getPodpislonSettings(orgId)
  if (!settings) {
    return { error: 'Подпислон не подключён — добавьте API-ключ в «Настройки → Электронная подпись»' }
  }
  if (!settings.isActive) return { error: 'Интеграция с Подпислоном выключена в настройках' }

  const { data, error } = await supabase
    .from('contracts')
    .select(
      `id, contract_number, contract_type, generated_docx_url, organization_id, client_contact_id,
       client_contact:contacts!contracts_client_contact_id_fkey ( id, full_name, phone )`
    )
    .eq('id', contractId)
    .single()

  if (error || !data) return { error: 'Договор не найден' }
  const contract = data as unknown as ContractRow

  if (!contract.generated_docx_url) {
    return { error: 'Сначала сформируйте документ — подписывать нечего' }
  }

  // ── Подписант ────────────────────────────────────────────────────────────
  const fioFromForm = (formData.get('signer_full_name') as string)?.trim() ?? ''
  const fullName = fioFromForm || contract.client_contact?.full_name || ''
  const { lastName, name, secondName } = splitFio(fullName)
  if (!lastName || !name) {
    return { error: 'Укажите фамилию и имя подписанта — сервис подписывает конкретное физлицо' }
  }

  const rawPhone = ((formData.get('signer_phone') as string) || contract.client_contact?.phone || '').trim()
  const phone = normalizePhone(rawPhone)
  if (!phone) return { error: 'Укажите телефон подписанта в формате +7XXXXXXXXXX — на него придёт код' }

  // ── Файл на подпись ──────────────────────────────────────────────────────
  let source: Buffer
  try {
    const response = await fetch(contract.generated_docx_url)
    if (!response.ok) throw new Error(`Storage вернул ${response.status}`)
    source = Buffer.from(await response.arrayBuffer())
  } catch (e) {
    console.error('[podpislon] не удалось получить файл договора:', e)
    return { error: 'Не удалось получить файл договора из хранилища' }
  }

  const variables = await buildContractVariables(contractId)
  const documentLabel = `Договор${contract.contract_number ? ` № ${contract.contract_number}` : ''} от ${variables.CONTRACT_DATE}`

  let pdf: Buffer
  try {
    pdf = await buildSignablePdf({
      source,
      title: CONTRACT_TYPE_MAP[contract.contract_type ?? '']?.docTitle ?? 'ДОГОВОР',
      consent: {
        operatorName: variables.ИСПОЛНИТЕЛЬ_НАЗВАНИЕ,
        operatorInn: variables.ИСПОЛНИТЕЛЬ_ИНН,
        operatorAddress: variables.ИСПОЛНИТЕЛЬ_АДРЕС,
        operatorPhone: variables.ИСПОЛНИТЕЛЬ_ТЕЛЕФОН,
        operatorEmail: null,
        signerName: fullName,
        signerPhone: phone,
        documentLabel,
        date: variables.CONTRACT_DATE,
      },
    })
  } catch (e) {
    console.error('[podpislon] не удалось собрать PDF:', e)
    return { error: 'Не удалось собрать PDF договора с согласиями' }
  }

  // Копию отправленного файла храним у себя: спор о том, что именно подписал
  // клиент, решается сравнением с этим файлом и его хэшем.
  let documentUrl: string | null = null
  try {
    documentUrl = await uploadContractFile(
      contractId,
      pdf,
      'contract-for-sign.pdf',
      'application/pdf'
    )
  } catch (e) {
    console.error('[podpislon] не удалось сохранить копию файла на подпись:', e)
  }

  // ── Отправка ─────────────────────────────────────────────────────────────
  const withoutSms = formData.get('without_sms') === 'on'
  const fileName = `${documentLabel}.pdf`.replace(/[\\/:*?"<>|]/g, '-')

  let sent
  try {
    sent = await addDocument({
      apiKey: settings.apiKey,
      name,
      lastName,
      secondName: secondName || null,
      phone,
      files: [{ fileName, content: pdf }],
      withoutSms,
      redirectUrl: `${getSiteUrl()}/sign/thanks`,
    })
  } catch (e) {
    if (e instanceof PodpislonError) return { error: e.message }
    console.error('[podpislon] ошибка отправки:', e)
    return { error: 'Не удалось отправить документ в Подпислон' }
  }

  const externalId = sent.ids[0] ? String(sent.ids[0]) : null
  const signUrl = sent.links[0] ?? null

  const { error: insertError } = await supabase.from('contract_signatures').insert({
    organization_id: orgId,
    contract_id: contractId,
    provider: 'podpislon',
    // Токен нашей внутренней подписи здесь не используется, но колонка
    // обязательная и уникальная — генерируем, чтобы записи жили в одной таблице.
    sign_token: generateSignToken(),
    signer_contact_id: contract.client_contact?.id ?? null,
    signer_name: fullName,
    signer_phone: phone,
    document_url: documentUrl,
    document_sha256: hashDocument(pdf),
    external_id: externalId,
    sign_url: signUrl,
    consent_version: SIGNING_CONSENT_VERSION,
    created_by: user.id,
  })

  if (insertError) return { error: insertError.message }

  // Клиент подписывает согласие на обработку ПД вместе с договором — отмечаем
  // это в карточке контакта, чтобы отметка 152-ФЗ не расходилась с реальностью.
  if (contract.client_contact?.id) {
    await supabase
      .from('contacts')
      .update(consentFields('crm_manual'))
      .eq('id', contract.client_contact.id)
  }

  await writeAuditLog({
    userId: user.id,
    orgId,
    action: 'update',
    entityType: 'contract',
    entityId: contractId,
    entityLabel: documentLabel,
    changes: { podpislon_sent: { old: null, new: `${fullName}, ${phone}` } },
  })

  revalidatePath(`/contracts/${contractId}`)

  return {
    success: true,
    signUrl,
    message: withoutSms
      ? 'Документ создан — отправьте клиенту ссылку на подписание'
      : `СМС с кодом отправлена на ${phone}`,
  }
}

/** Подтягивает статус подписания из сервиса — кнопка «Обновить» в карточке. */
export async function refreshPodpislonStatusAction(signatureId: string): Promise<PodpislonActionResult> {
  const ctx = await getSessionContext()
  if (!ctx.ok) return { error: ctx.error }
  const { supabase, user, orgId } = ctx

  const settings = await getPodpislonSettings(orgId)
  if (!settings) return { error: 'Подпислон не подключён' }

  const { data } = await supabase
    .from('contract_signatures')
    .select('id, contract_id, organization_id, status, external_id, external_package_id, sign_url, signed_document_url')
    .eq('id', signatureId)
    .eq('provider', 'podpislon')
    .maybeSingle()

  if (!data) return { error: 'Запрос на подпись не найден' }

  try {
    const result = await syncPodpislonSignature(supabase, settings.apiKey, data as SignatureRow)
    revalidatePath(`/contracts/${data.contract_id}`)
    return {
      success: true,
      signUrl: result.signUrl,
      message: result.status === 'signed' ? 'Договор подписан' : 'Статус обновлён',
    }
  } catch (e) {
    if (e instanceof PodpislonError) return { error: e.message }
    console.error('[podpislon] ошибка синхронизации:', e)
    return { error: 'Не удалось получить статус из Подпислона' }
  }
}

/** Переотправляет клиенту ссылку на подписание (сервис разрешает до 5 раз). */
export async function resendPodpislonLinkAction(signatureId: string): Promise<PodpislonActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const rl = await rateLimitMutation(user.id, 'podpislon_resend')
  if (!rl.success) return { error: 'Слишком много запросов. Подождите минуту.' }

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const permError = await requirePermission(user.id, 'contracts', 'update')
  if (permError) return { error: permError.error }

  const settings = await getPodpislonSettings(orgId)
  if (!settings) return { error: 'Подпислон не подключён' }

  const { data } = await supabase
    .from('contract_signatures')
    .select('id, external_package_id, contract_id')
    .eq('id', signatureId)
    .eq('provider', 'podpislon')
    .maybeSingle()

  if (!data?.external_package_id) {
    return { error: 'Не знаем идентификатор пакета — обновите статус и попробуйте снова' }
  }

  try {
    await resendPackage(settings.apiKey, data.external_package_id)
    revalidatePath(`/contracts/${data.contract_id}`)
    return { success: true, message: 'Ссылка отправлена клиенту повторно' }
  } catch (e) {
    if (e instanceof PodpislonError) return { error: e.message }
    return { error: 'Не удалось переотправить ссылку' }
  }
}

/** Проверка ключа на странице настроек: показываем, чью компанию видит сервис. */
export async function checkPodpislonKeyAction(): Promise<PodpislonActionResult> {
  const ctx = await getSessionContext()
  if (!ctx.ok) return { error: ctx.error }
  const { supabase, user, orgId } = ctx

  const permError = await requirePermission(user.id, 'settings', 'read')
  if (permError) return { error: permError.error }

  const settings = await getPodpislonSettings(orgId)
  if (!settings) return { error: 'Сначала сохраните API-ключ' }

  try {
    const company = await getCompanyInfo(settings.apiKey)
    const balance = company.balance !== undefined ? `, документов на балансе: ${company.balance}` : ''
    return {
      success: true,
      message: `Ключ рабочий. Компания: ${company.name ?? 'без названия'}${company.inn ? `, ИНН ${company.inn}` : ''}${balance}`,
    }
  } catch (e) {
    if (e instanceof PodpislonError) return { error: e.message }
    return { error: 'Не удалось связаться с Подпислоном' }
  }
}
