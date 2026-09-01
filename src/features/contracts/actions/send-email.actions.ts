'use server'

import { createClient } from '@/lib/supabase/server'
import { requireOrgId } from '@/lib/org'
import { requirePermission } from '@/lib/permissions'
import { rateLimitMutation } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'
import { isValidEmail } from '@/lib/email/provider'
import { sendContractReadyEmail } from '@/lib/email/send'

/** 15 МБ — за этим порогом письмо почти гарантированно отобьётся у получателя. */
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024

interface ContractRow {
  id: string
  contract_number: string | null
  contract_type: string
  start_date: string | null
  end_date: string | null
  amount: number | null
  generated_docx_url: string | null
  organization_id: string
  properties: { address: string | null } | null
  contacts: { email: string | null; full_name: string | null } | null
}

/**
 * Отправляет клиенту сформированный договор письмом с вложением.
 * Файл берём по подписанной ссылке из generated_docx_url — она уже лежит
 * в договоре после генерации (uploadContractFile создаёт signed URL на год).
 */
export async function sendContractByEmailAction(contractId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const rl = await rateLimitMutation(user.id, 'contract_email')
  if (!rl.success) return { error: 'Слишком много запросов. Подождите минуту.' }

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const permError = await requirePermission(user.id, 'contracts', 'read')
  if (permError) return permError

  const { data, error } = await supabase
    .from('contracts')
    .select(
      `id, contract_number, contract_type, start_date, end_date, amount, generated_docx_url, organization_id,
       properties:property_id ( address ),
       contacts:client_contact_id ( email, full_name )`
    )
    .eq('id', contractId)
    .single()

  if (error || !data) return { error: 'Договор не найден' }
  const contract = data as unknown as ContractRow

  const explicit = (formData.get('email') as string)?.trim()
  const to = explicit || contract.contacts?.email || ''
  if (!isValidEmail(to)) {
    return { error: 'Укажите корректный email получателя — в карточке клиента адрес не заполнен' }
  }

  if (!contract.generated_docx_url) {
    return { error: 'Договор ещё не сформирован — сначала нажмите «Сформировать DOCX»' }
  }

  // Тянем файл по подписанной ссылке. Если она протухла или Storage недоступен,
  // письмо всё равно уходит — но без вложения это бессмысленно, поэтому падаем с ошибкой.
  let attachmentBase64: string
  try {
    const res = await fetch(contract.generated_docx_url)
    if (!res.ok) throw new Error(`Storage вернул ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.byteLength > MAX_ATTACHMENT_BYTES) {
      return { error: 'Файл договора больше 15 МБ — отправьте ссылкой вручную' }
    }
    attachmentBase64 = buf.toString('base64')
  } catch (e) {
    console.error('[contracts] не удалось скачать DOCX для письма:', e)
    return { error: 'Не удалось получить файл договора из хранилища' }
  }

  const result = await sendContractReadyEmail({
    orgId,
    to,
    contractId: contract.id,
    contractNumber: contract.contract_number,
    contractType: contract.contract_type,
    address: contract.properties?.address ?? null,
    startDate: contract.start_date,
    endDate: contract.end_date,
    amount: contract.amount,
    comment: (formData.get('comment') as string)?.trim() || null,
    attachment: {
      filename: `Договор${contract.contract_number ? ` №${contract.contract_number}` : ''}.docx`,
      content: attachmentBase64,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },
  })

  if (!result.ok) return { error: result.error ?? 'Не удалось отправить письмо' }
  if (result.skipped) {
    return { error: 'Почта не настроена: задайте RESEND_API_KEY или UNISENDER_API_KEY в окружении' }
  }

  await writeAuditLog({
    userId: user.id,
    orgId,
    action: 'update',
    entityType: 'contract',
    entityId: contract.id,
    entityLabel: `Договор ${contract.contract_number ?? ''}`.trim(),
    changes: { email_sent: { old: null, new: to } },
  })

  return { success: true, message: `Договор отправлен на ${to}` }
}
