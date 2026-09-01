'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireOrgId } from '@/lib/org'
import { requirePermission } from '@/lib/permissions'
import { rateLimitMutation } from '@/lib/rate-limit'
import { getChannelIntegration } from '@/lib/communications/log'
import { getSiteUrl } from '@/lib/telegram/site-url'
import {
  createYookassaPayment,
  hasYookassaCredentials,
  YookassaError,
} from '@/lib/payments/yookassa'
import { sendPaymentReminderEmail } from '@/lib/email/send'
import { isValidEmail } from '@/lib/email/provider'

export interface PaymentLinkResult {
  error?: string
  success?: boolean
  url?: string
  message?: string
}

interface TxRow {
  id: string
  amount: number
  due_date: string | null
  description: string | null
  status: string
  payment_url: string | null
  organization_id: string
  contracts: {
    contract_number: string | null
    contacts: { full_name: string | null; email: string | null; phone: string | null } | null
    properties: { address: string | null } | null
  } | null
}

/**
 * Создаёт ссылку на онлайн-оплату начисления через эквайринг организации.
 *
 * Раньше платёж можно было только отметить руками после того, как деньги
 * пришли на счёт; теперь арендатору отправляется ссылка, а статус обновляется
 * вебхуком — сверка перестаёт быть ручной работой.
 */
export async function createPaymentLinkAction(
  transactionId: string,
  options?: { sendEmail?: boolean }
): Promise<PaymentLinkResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const rl = await rateLimitMutation(user.id, 'payment_link')
  if (!rl.success) return { error: 'Слишком много запросов. Подождите минуту.' }

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const permError = await requirePermission(user.id, 'accounting', 'update')
  if (permError) return permError

  const { data, error } = await supabase
    .from('accounting_transactions')
    .select(
      `id, amount, due_date, description, status, payment_url, organization_id,
       contracts:contract_id (
         contract_number,
         contacts:client_contact_id ( full_name, email, phone ),
         properties:property_id ( address )
       )`
    )
    .eq('id', transactionId)
    .single()

  if (error || !data) return { error: 'Начисление не найдено' }
  const tx = data as unknown as TxRow

  if (tx.status === 'completed') return { error: 'Начисление уже оплачено' }
  if (tx.amount <= 0) return { error: 'Некорректная сумма начисления' }

  // Готовая ссылка не пересоздаётся: у ЮKassa платёж живёт ограниченное время,
  // но два разных счёта на одну сумму путают и клиента, и бухгалтерию.
  if (tx.payment_url) {
    if (options?.sendEmail) return sendLink(orgId, tx, tx.payment_url)
    return { success: true, url: tx.payment_url, message: 'Ссылка уже создана' }
  }

  const integration = await getChannelIntegration(orgId, 'payments')
  if (!integration || !integration.is_active) {
    return { error: 'Приём платежей не подключён — настройте его в «Настройки → Приём платежей»' }
  }
  if (integration.provider !== 'yookassa') {
    return { error: `Провайдер «${integration.provider}» пока не поддерживается` }
  }

  const credentials = (integration.credentials ?? {}) as Record<string, unknown>
  if (!hasYookassaCredentials(credentials)) {
    return { error: 'В настройках ЮKassa не заполнены shopId и секретный ключ' }
  }

  const contract = tx.contracts
  const description =
    tx.description ??
    `Оплата${contract?.contract_number ? ` по договору №${contract.contract_number}` : ''}`

  let payment
  try {
    payment = await createYookassaPayment({
      credentials: { shopId: credentials.shopId, secretKey: credentials.secretKey },
      amount: Number(tx.amount),
      description,
      returnUrl: `${getSiteUrl()}/`,
      // Один платёж на одно начисление: ретрай запроса не создаст второй счёт.
      idempotenceKey: tx.id,
      metadata: { transaction_id: tx.id, organization_id: orgId },
      customerEmail: contract?.contacts?.email ?? null,
      customerPhone: contract?.contacts?.phone ?? null,
    })
  } catch (e) {
    const message = e instanceof YookassaError ? e.message : 'Не удалось создать платёж'
    console.error('[payments] ЮKassa:', e)
    return { error: message }
  }

  const { error: updateError } = await supabase
    .from('accounting_transactions')
    .update({
      payment_url: payment.confirmationUrl,
      payment_external_id: payment.id,
      payment_provider: 'yookassa',
    })
    .eq('id', tx.id)

  if (updateError) return { error: updateError.message }

  revalidatePath('/accounting')
  if (payment.confirmationUrl && options?.sendEmail) {
    return sendLink(orgId, tx, payment.confirmationUrl)
  }

  return { success: true, url: payment.confirmationUrl ?? undefined, message: 'Ссылка на оплату создана' }
}

/** Отправляет ссылку клиенту письмом — тем же шаблоном, что и напоминание. */
async function sendLink(orgId: string, tx: TxRow, url: string): Promise<PaymentLinkResult> {
  const email = tx.contracts?.contacts?.email ?? null
  if (!isValidEmail(email)) {
    return { success: true, url, message: 'Ссылка создана, но у клиента не указан email' }
  }

  const result = await sendPaymentReminderEmail({
    orgId,
    to: email,
    amount: tx.amount,
    dueDate: tx.due_date,
    contractNumber: tx.contracts?.contract_number ?? null,
    address: tx.contracts?.properties?.address ?? null,
    paymentId: tx.id,
    payUrl: url,
  })

  if (!result.ok || result.skipped) {
    return { success: true, url, message: 'Ссылка создана, письмо не отправлено (почта не настроена)' }
  }

  return { success: true, url, message: `Ссылка отправлена на ${email}` }
}
