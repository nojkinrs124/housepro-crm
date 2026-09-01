// Разбор банковской выписки в формате 1C (1CClientBankExchange).
//
// Этот текстовый формат выгружает любой банк-клиент — Сбербанк Бизнес,
// Т-Бизнес, Альфа, Точка. Он и есть самый реалистичный путь автосверки для
// агентства без эквайринга: деньги приходят на расчётный счёт, а не картой,
// и до сих пор отмечались в CRM руками по одной строке.
//
// Кодировка почти всегда windows-1251 — файл, прочитанный как UTF-8,
// превращается в кракозябры, поэтому декодирование выбирается по заголовку.

export interface BankDocument {
  /** Номер платёжного документа в банке. */
  number: string | null
  date: string | null
  amount: number
  payerName: string | null
  payerInn: string | null
  payerAccount: string | null
  recipientName: string | null
  recipientInn: string | null
  recipientAccount: string | null
  purpose: string | null
  /** true — деньги пришли нам, false — ушли от нас. Считается по счёту организации. */
  incoming: boolean
}

export interface BankStatement {
  /** Расчётный счёт, по которому сформирована выписка. */
  account: string | null
  dateFrom: string | null
  dateTo: string | null
  documents: BankDocument[]
}

/** Дата в выписке — ДД.ММ.ГГГГ; приводим к ISO без времени. */
function parseDate(value: string | undefined): string | null {
  if (!value) return null
  const match = value.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  if (!match) return null
  return `${match[3]}-${match[2]}-${match[1]}`
}

function parseAmount(value: string | undefined): number {
  if (!value) return 0
  const n = Number.parseFloat(value.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/**
 * Декодирует буфер выписки. Заголовок «Кодировка=» пишется латиницей и читается
 * одинаково в обеих кодировках, поэтому сначала пробуем win-1251 и смотрим,
 * не получился ли мусор.
 */
export function decodeStatement(buffer: Buffer): string {
  const utf8 = buffer.toString('utf-8')
  // Признак неверной кодировки — символ замены U+FFFD.
  if (!utf8.includes('�')) return utf8

  try {
    return new TextDecoder('windows-1251').decode(buffer)
  } catch {
    return utf8
  }
}

/** Строки формата — «Ключ=Значение», секции документов между СекцияДокумент и КонецДокумента. */
export function parse1CStatement(text: string, ourAccounts: string[] = []): BankStatement {
  const lines = text.split(/\r?\n/)

  const header: Record<string, string> = {}
  const documents: BankDocument[] = []
  let current: Record<string, string> | null = null

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line === '') continue

    if (line.startsWith('СекцияДокумент')) {
      current = {}
      continue
    }
    if (line.startsWith('КонецДокумента')) {
      if (current) documents.push(toDocument(current, ourAccounts, header.РасчСчет))
      current = null
      continue
    }
    if (line === 'КонецФайла') break

    const separator = line.indexOf('=')
    if (separator === -1) continue

    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim()

    if (current) current[key] = value
    else header[key] = value
  }

  return {
    account: header.РасчСчет ?? null,
    dateFrom: parseDate(header.ДатаНачала),
    dateTo: parseDate(header.ДатаКонца),
    documents,
  }
}

function toDocument(
  fields: Record<string, string>,
  ourAccounts: string[],
  headerAccount: string | undefined
): BankDocument {
  const recipientAccount = fields.ПолучательСчет ?? null
  const accounts = ourAccounts.length > 0 ? ourAccounts : headerAccount ? [headerAccount] : []
  const normalized = accounts.map((a) => a.replace(/\D/g, ''))

  // Входящий платёж — тот, где счёт получателя наш. Если счета организации
  // неизвестны, ориентируемся на счёт из шапки выписки.
  const incoming = normalized.length === 0
    ? true
    : normalized.includes((recipientAccount ?? '').replace(/\D/g, ''))

  return {
    number: fields.Номер ?? null,
    date: parseDate(fields.Дата),
    amount: parseAmount(fields.Сумма),
    payerName: fields.Плательщик ?? fields.Плательщик1 ?? null,
    payerInn: fields.ПлательщикИНН ?? null,
    payerAccount: fields.ПлательщикСчет ?? null,
    recipientName: fields.Получатель ?? fields.Получатель1 ?? null,
    recipientInn: fields.ПолучательИНН ?? null,
    recipientAccount,
    purpose: fields.НазначениеПлатежа ?? null,
    incoming,
  }
}

/** Номер договора из назначения платежа: «... по договору № 12-АР от ...». */
export function contractNumberFromPurpose(purpose: string | null): string | null {
  if (!purpose) return null
  const match = purpose.match(/договор[а-я]*\s*(?:№|N|номер)?\s*([A-Za-zА-Яа-я0-9/-]{1,20})/i)
  return match ? match[1].replace(/[.,;]$/, '') : null
}

export interface MatchCandidate {
  /** id начисления в accounting_transactions. */
  transactionId: string
  amount: number
  dueDate: string | null
  description: string | null
  contractNumber: string | null
  /** Насколько уверенно сопоставили: 'exact' — сумма и договор, 'amount' — только сумма. */
  confidence: 'exact' | 'amount'
}

export interface PlannedTransaction {
  id: string
  amount: number
  due_date: string | null
  description: string | null
  contract_number: string | null
  client_inn: string | null
}

/**
 * Подбирает начисление под входящий платёж.
 *
 * Порядок важен: сначала совпадение по номеру договора вместе с суммой, потом
 * по ИНН плательщика, и только затем по одной сумме. Совпадение «только по
 * сумме» помечается как ненадёжное — такие строки пользователь подтверждает
 * сам, автоматически они не применяются.
 */
export function matchDocument(
  doc: BankDocument,
  planned: PlannedTransaction[],
  toleranceRubles = 1
): MatchCandidate | null {
  const amountMatches = planned.filter((p) => Math.abs(Number(p.amount) - doc.amount) <= toleranceRubles)
  if (amountMatches.length === 0) return null

  const contractNumber = contractNumberFromPurpose(doc.purpose)
  const payerInn = doc.payerInn?.trim()

  const byContract = contractNumber
    ? amountMatches.find(
        (p) => p.contract_number && p.contract_number.toLowerCase() === contractNumber.toLowerCase()
      )
    : undefined

  if (byContract) {
    return {
      transactionId: byContract.id,
      amount: Number(byContract.amount),
      dueDate: byContract.due_date,
      description: byContract.description,
      contractNumber: byContract.contract_number,
      confidence: 'exact',
    }
  }

  const byInn = payerInn ? amountMatches.find((p) => p.client_inn && p.client_inn === payerInn) : undefined
  if (byInn) {
    return {
      transactionId: byInn.id,
      amount: Number(byInn.amount),
      dueDate: byInn.due_date,
      description: byInn.description,
      contractNumber: byInn.contract_number,
      confidence: 'exact',
    }
  }

  // Единственное совпадение по сумме — кандидат, но требующий подтверждения.
  // Если таких несколько, выбор неоднозначен, и предлагать наугад нельзя.
  if (amountMatches.length > 1) return null

  const only = amountMatches[0]
  return {
    transactionId: only.id,
    amount: Number(only.amount),
    dueDate: only.due_date,
    description: only.description,
    contractNumber: only.contract_number,
    confidence: 'amount',
  }
}
