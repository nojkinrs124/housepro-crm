'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireOrgId } from '@/lib/org'
import { requirePermission } from '@/lib/permissions'
import { rateLimitMutation } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'
import {
  decodeStatement,
  matchDocument,
  parse1CStatement,
  type BankDocument,
  type MatchCandidate,
  type PlannedTransaction,
} from '@/lib/import/bank-statement'

/** Выписка за месяц — это десятки строк; ограничение защищает от случайного дампа за год. */
const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_DOCUMENTS = 500

export interface BankStatementRow {
  /** Индекс документа в выписке — им же клиент помечает, что применить. */
  index: number
  number: string | null
  date: string | null
  amount: number
  payerName: string | null
  purpose: string | null
  incoming: boolean
  match: MatchCandidate | null
}

export interface ParseStatementResult {
  error?: string
  account?: string | null
  rows?: BankStatementRow[]
  /** Сколько входящих платежей не нашли пары среди плановых начислений. */
  unmatched?: number
}

interface PlannedRow {
  id: string
  amount: number
  due_date: string | null
  description: string | null
  contracts: {
    contract_number: string | null
    contacts: { inn: string | null } | null
  } | null
}

/**
 * Разбирает выгрузку из банк-клиента и подбирает, какому начислению
 * соответствует каждый входящий платёж.
 *
 * Ничего не меняет в базе: сверка — операция, где ошибка дорого стоит,
 * поэтому применение вынесено в отдельное подтверждённое действие.
 */
export async function parseBankStatementAction(
  _prevState: unknown,
  formData: FormData
): Promise<ParseStatementResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const rl = await rateLimitMutation(user.id, 'bank_import')
  if (!rl.success) return { error: 'Слишком много запросов. Подождите минуту.' }

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const permError = await requirePermission(user.id, 'accounting', 'update')
  if (permError) return { error: permError.error }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { error: 'Выберите файл выписки' }
  if (file.size > MAX_FILE_BYTES) return { error: 'Файл больше 5 МБ — выгрузите выписку за меньший период' }

  const text = decodeStatement(Buffer.from(await file.arrayBuffer()))
  if (!text.includes('1CClientBankExchange')) {
    return {
      error: 'Это не выписка в формате 1C. В банк-клиенте выберите выгрузку «1С:Предприятие» (файл .txt).',
    }
  }

  // Счета организации нужны, чтобы отличить входящие платежи от исходящих.
  const { data: companies } = await supabase.from('company_settings').select('bank_account')
  const ourAccounts = (companies ?? [])
    .map((c) => c.bank_account)
    .filter((a): a is string => Boolean(a))

  const statement = parse1CStatement(text, ourAccounts)
  const incoming = statement.documents.filter((d) => d.incoming).slice(0, MAX_DOCUMENTS)

  if (incoming.length === 0) {
    return { error: 'В выписке нет входящих платежей на счета организации' }
  }

  const { data: plannedRaw } = await supabase
    .from('accounting_transactions')
    .select(
      `id, amount, due_date, description,
       contracts:contract_id ( contract_number, contacts:client_contact_id ( inn ) )`
    )
    .eq('organization_id', orgId)
    .eq('type', 'income')
    .eq('status', 'planned')
    .limit(1000)

  const planned: PlannedTransaction[] = ((plannedRaw ?? []) as unknown as PlannedRow[]).map((row) => ({
    id: row.id,
    amount: Number(row.amount),
    due_date: row.due_date,
    description: row.description,
    contract_number: row.contracts?.contract_number ?? null,
    client_inn: row.contracts?.contacts?.inn ?? null,
  }))

  // Одно начисление не должно достаться двум платежам сразу.
  const used = new Set<string>()
  const rows: BankStatementRow[] = incoming.map((doc: BankDocument, index) => {
    const candidates = planned.filter((p) => !used.has(p.id))
    const match = matchDocument(doc, candidates)
    if (match) used.add(match.transactionId)

    return {
      index,
      number: doc.number,
      date: doc.date,
      amount: doc.amount,
      payerName: doc.payerName,
      purpose: doc.purpose,
      incoming: doc.incoming,
      match,
    }
  })

  return {
    account: statement.account,
    rows,
    unmatched: rows.filter((r) => !r.match).length,
  }
}

export interface ApplyStatementResult {
  error?: string
  success?: boolean
  applied?: number
}

export interface StatementApplyItem {
  transactionId: string
  /** Дата платежа из выписки — именно она становится датой оплаты. */
  paidOn: string | null
  amount: number
  /** Номер платёжного документа — попадает в примечание для последующего поиска. */
  documentNumber: string | null
}

/**
 * Отмечает выбранные начисления оплаченными по данным выписки.
 *
 * Дата берётся из платёжного документа, а не «сегодня»: выписку часто грузят
 * задним числом, и неверная дата оплаты искажает отчёты по месяцам.
 */
export async function applyBankStatementAction(items: StatementApplyItem[]): Promise<ApplyStatementResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  if (!Array.isArray(items) || items.length === 0) return { error: 'Не выбрано ни одного платежа' }

  const rl = await rateLimitMutation(user.id, 'bank_apply')
  if (!rl.success) return { error: 'Слишком много запросов. Подождите минуту.' }

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const permError = await requirePermission(user.id, 'accounting', 'update')
  if (permError) return { error: permError.error }

  const { advanceDealStage } = await import('@/lib/deal-automation')

  let applied = 0
  for (const item of items) {
    const paidOn = item.paidOn ?? new Date().toISOString().slice(0, 10)

    const { data: updated, error } = await supabase
      .from('accounting_transactions')
      .update({
        status: 'completed',
        date: paidOn,
        paid_at: new Date(`${paidOn}T12:00:00Z`).toISOString(),
        payment_method: 'bank',
        // Номер платёжного поручения — по нему потом ищут платёж в банке.
        // Отдельная колонка, а не payment_external_id: там уникальный индекс,
        // а номера платёжек повторяются от банка к банку и год от года.
        bank_document_number: item.documentNumber,
      })
      .eq('id', item.transactionId)
      .eq('organization_id', orgId)
      .eq('status', 'planned')
      .select('id, deal_id')
      .maybeSingle()

    if (error || !updated) continue

    applied += 1
    // Та же автоматизация, что при ручной отметке оплаты и при эквайринге.
    if (updated.deal_id) await advanceDealStage(supabase, updated.deal_id, 'completed')
  }

  if (applied === 0) return { error: 'Ни одно начисление не удалось отметить — возможно, они уже оплачены' }

  await writeAuditLog({
    userId: user.id,
    orgId,
    action: 'update',
    entityType: 'accounting_transactions',
    entityId: orgId,
    entityLabel: 'Сверка банковской выписки',
    changes: { bank_import: { old: null, new: `Отмечено оплаченными: ${applied}` } },
  })

  revalidatePath('/accounting')
  return { success: true, applied }
}
