'use server'

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { requireOrgId } from '@/lib/org'
import { requirePermission } from '@/lib/permissions'
import { rateLimit, rateLimitMutation } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'
import { isValidEmail } from '@/lib/email/provider'
import { sendEmail } from '@/lib/email/send'
import { layout, p as paragraph, rows } from '@/lib/email/templates'
import { getSiteUrl } from '@/lib/telegram/site-url'
import {
  CODE_TTL_MINUTES,
  MAX_CODE_ATTEMPTS,
  generateSignCode,
  generateSignToken,
  hashDocument,
  hashSignCode,
  verifySignCode,
} from '@/lib/signing'

export interface SigningResult {
  error?: string
  success?: boolean
  message?: string
  /** Ссылка на подписание — её отдают клиенту. */
  url?: string
}

interface ContractRow {
  id: string
  contract_number: string | null
  generated_docx_url: string | null
  organization_id: string
  status: string
  contacts: { id: string; full_name: string | null; email: string | null; phone: string | null } | null
}

/**
 * Создаёт запрос на подписание и отправляет клиенту ссылку.
 *
 * Хэш файла считается сразу: подписант увидит и подпишет ровно тот документ,
 * который зафиксирован в этот момент. Если позже сформировать новую версию
 * DOCX, старая подпись останется привязанной к старому хэшу — и это правильно.
 */
export async function createSignatureRequestAction(
  contractId: string,
  formData: FormData
): Promise<SigningResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const rl = await rateLimitMutation(user.id, 'signature_request')
  if (!rl.success) return { error: 'Слишком много запросов. Подождите минуту.' }

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const permError = await requirePermission(user.id, 'contracts', 'update')
  if (permError) return { error: permError.error }

  const { data, error } = await supabase
    .from('contracts')
    .select(
      `id, contract_number, generated_docx_url, organization_id, status,
       contacts:client_contact_id ( id, full_name, email, phone )`
    )
    .eq('id', contractId)
    .single()

  if (error || !data) return { error: 'Договор не найден' }
  const contract = data as unknown as ContractRow

  if (!contract.generated_docx_url) {
    return { error: 'Сначала сформируйте DOCX — подписывать нечего' }
  }

  const email = ((formData.get('email') as string) || contract.contacts?.email || '').trim()
  if (!isValidEmail(email)) {
    return { error: 'Укажите email подписанта — на него придёт ссылка и код' }
  }

  // Считаем хэш файла, который отправляем на подпись.
  let documentSha256: string
  try {
    const res = await fetch(contract.generated_docx_url)
    if (!res.ok) throw new Error(`Storage вернул ${res.status}`)
    documentSha256 = hashDocument(Buffer.from(await res.arrayBuffer()))
  } catch (e) {
    console.error('[signing] не удалось получить файл договора:', e)
    return { error: 'Не удалось получить файл договора из хранилища' }
  }

  const token = generateSignToken()

  const { error: insertError } = await supabase.from('contract_signatures').insert({
    organization_id: orgId,
    contract_id: contractId,
    sign_token: token,
    signer_contact_id: contract.contacts?.id ?? null,
    signer_name: (formData.get('signer_name') as string)?.trim() || contract.contacts?.full_name || null,
    signer_email: email,
    signer_phone: contract.contacts?.phone ?? null,
    document_url: contract.generated_docx_url,
    document_sha256: documentSha256,
    created_by: user.id,
  })

  if (insertError) return { error: insertError.message }

  const url = `${getSiteUrl()}/sign/${token}`
  const html = layout(
    'Договор на подпись',
    paragraph(
      `Вам направлен на подписание договор${contract.contract_number ? ` № ${contract.contract_number}` : ''}.`
    ) +
      paragraph(
        'Откройте ссылку, прочитайте документ и подтвердите подписание кодом — он придёт отдельным письмом.'
      ),
    { cta: { label: 'Открыть договор', url } }
  )

  await sendEmail({
    orgId,
    to: email,
    subject: `Договор${contract.contract_number ? ` № ${contract.contract_number}` : ''} на подпись`,
    html,
    kind: 'contract_ready',
    entityType: 'contract',
    entityId: contractId,
  })

  await writeAuditLog({
    userId: user.id,
    orgId,
    action: 'update',
    entityType: 'contract',
    entityId: contractId,
    entityLabel: `Договор ${contract.contract_number ?? ''}`.trim(),
    changes: { signature_requested: { old: null, new: email } },
  })

  revalidatePath(`/contracts/${contractId}`)
  return { success: true, url, message: `Ссылка на подписание отправлена на ${email}` }
}

/**
 * Отправляет одноразовый код подписанту.
 *
 * Публичное действие: вызывается со страницы /sign/[token], где у посетителя
 * нет сессии. Защита — сам токен (32 случайных байта) и лимит по IP: иначе
 * страницу можно было бы использовать как бесплатную рассылку писем.
 */
export async function requestSignCodeAction(token: string): Promise<SigningResult> {
  const supabase = getSupabaseAdmin()

  const headerList = await headers()
  const ip = headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = await rateLimit(`sign-code:${ip}`, { limit: 5, windowSeconds: 300 })
  if (!rl.success) return { error: 'Слишком много запросов кода. Попробуйте через несколько минут.' }

  const { data: signature } = await supabase
    .from('contract_signatures')
    .select('id, status, signer_email, expires_at, organization_id, contract_id, contracts:contract_id(contract_number)')
    .eq('sign_token', token)
    .maybeSingle()

  if (!signature) return { error: 'Ссылка недействительна' }
  if (signature.status === 'signed') return { error: 'Договор уже подписан' }
  if (new Date(signature.expires_at) < new Date()) return { error: 'Срок действия ссылки истёк' }
  if (!isValidEmail(signature.signer_email)) return { error: 'У запроса не указан корректный email' }

  const code = generateSignCode()
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString()

  const { error } = await supabase
    .from('contract_signatures')
    .update({
      code_hash: hashSignCode(code, token),
      code_expires_at: expiresAt,
      code_attempts: 0,
      code_sent_at: new Date().toISOString(),
      status: signature.status === 'pending' ? 'viewed' : signature.status,
    })
    .eq('id', signature.id)

  if (error) return { error: 'Не удалось выдать код, попробуйте ещё раз' }

  const contract = Array.isArray(signature.contracts) ? signature.contracts[0] : signature.contracts
  const html = layout(
    'Код для подписания',
    paragraph('Введите этот код на странице подписания договора:') +
      `<p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:16px 0;">${code}</p>` +
      rows([
        ['Договор', contract?.contract_number ?? null],
        ['Код действует', `${CODE_TTL_MINUTES} минут`],
      ]) +
      paragraph('Если вы не запрашивали код — просто проигнорируйте это письмо.'),
  )

  const sent = await sendEmail({
    orgId: signature.organization_id,
    to: signature.signer_email,
    subject: 'Код для подписания договора',
    html,
    kind: 'custom',
    entityType: 'contract',
    entityId: signature.contract_id,
  })

  if (!sent.ok || sent.skipped) {
    return { error: 'Не удалось отправить код — свяжитесь с агентством' }
  }

  return { success: true, message: 'Код отправлен на вашу почту' }
}

/**
 * Проверяет код и фиксирует подпись.
 *
 * Вместе с фактом подписания сохраняем IP и user-agent: юридическую силу
 * простой ЭП даёт именно совокупность доказательств, а не сам по себе код.
 */
export async function confirmSignAction(token: string, code: string): Promise<SigningResult> {
  const supabase = getSupabaseAdmin()

  const headerList = await headers()
  const ip = headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const userAgent = headerList.get('user-agent') ?? null

  const rl = await rateLimit(`sign-confirm:${ip}`, { limit: 10, windowSeconds: 300 })
  if (!rl.success) return { error: 'Слишком много попыток. Попробуйте позже.' }

  const cleaned = code.replace(/\D/g, '')
  if (cleaned.length !== 6) return { error: 'Код состоит из шести цифр' }

  const { data: signature } = await supabase
    .from('contract_signatures')
    .select('id, status, code_hash, code_expires_at, code_attempts, expires_at, contract_id, organization_id, signer_email')
    .eq('sign_token', token)
    .maybeSingle()

  if (!signature) return { error: 'Ссылка недействительна' }
  if (signature.status === 'signed') return { error: 'Договор уже подписан' }
  if (new Date(signature.expires_at) < new Date()) return { error: 'Срок действия ссылки истёк' }
  if (!signature.code_hash || !signature.code_expires_at) {
    return { error: 'Сначала запросите код' }
  }
  if (new Date(signature.code_expires_at) < new Date()) {
    return { error: 'Код просрочен — запросите новый' }
  }
  if ((signature.code_attempts ?? 0) >= MAX_CODE_ATTEMPTS) {
    return { error: 'Слишком много неверных попыток — запросите новый код' }
  }

  if (!verifySignCode(cleaned, token, signature.code_hash)) {
    await supabase
      .from('contract_signatures')
      .update({ code_attempts: (signature.code_attempts ?? 0) + 1 })
      .eq('id', signature.id)
    return { error: 'Неверный код' }
  }

  const signedAt = new Date().toISOString()
  const { error } = await supabase
    .from('contract_signatures')
    .update({
      status: 'signed',
      signed_at: signedAt,
      signer_ip: ip,
      signer_user_agent: userAgent,
      // Код больше не нужен и не должен лежать в базе после использования.
      code_hash: null,
      code_expires_at: null,
    })
    .eq('id', signature.id)

  if (error) return { error: 'Не удалось зафиксировать подпись' }

  // Договор переходит в «подписан» — тот же статус, что ставится вручную.
  await supabase.from('contracts').update({ status: 'signed' }).eq('id', signature.contract_id)

  revalidatePath(`/contracts/${signature.contract_id}`)
  return { success: true, message: 'Договор подписан' }
}
