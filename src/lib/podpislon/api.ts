// Клиент API сервиса «Подпислон» — простая электронная подпись документов
// физическими лицами по коду из СМС.
//
// Документация: https://api.podpislon.ru (OpenAPI 3.1). Обратите внимание:
// документация лежит на api.podpislon.ru, а запросы уходят на другой хост —
// https://podpislon.ru/integration. Авторизация — заголовок X-Api-Key,
// лимит 4 запроса в секунду на ключ.
//
// Почему не официальный SDK (@podpislon/podpislon-sdk): он тонкая обёртка над
// теми же четырьмя запросами, но тянет ещё одну зависимость и не типизирован
// под наш стек. Прямой fetch честнее и короче.

const API_BASE = 'https://podpislon.ru/integration'

/** Коды статусов документа из спецификации (поле status). */
export const PODPISLON_STATUS = {
  created: '10',
  sent: '15',
  opened: '20',
  signed: '30',
  revocationRequested: '35',
  revoked: '40',
} as const

export class PodpislonError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message)
    this.name = 'PodpislonError'
  }
}

export interface PodpislonContact {
  name?: string
  second_name?: string
  last_name?: string
  phone?: string
  sid?: string
  /** Персональная ссылка на подписание — приходит в ответе списка документов. */
  link?: string
}

export interface PodpislonDocument {
  id: number
  name?: string
  status?: string
  status_text?: string
  /** Код из СМС — сервис отдаёт его владельцу ключа. */
  sms?: string
  date_create?: string
  contact?: PodpislonContact
  contacts?: PodpislonContact[]
  package?: string
}

export interface PodpislonCompany {
  name?: string
  inn?: string
  kpp?: string
  /** Остаток документов на балансе — приходит не во всех тарифах. */
  balance?: number | string
}

interface RequestOptions {
  apiKey: string
  path: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  /** Тело как form-urlencoded — так требуют /get-file и список документов. */
  form?: Record<string, string>
}

async function request<T>({ apiKey, path, method = 'GET', body, form }: RequestOptions): Promise<T> {
  const headers: Record<string, string> = { 'X-Api-Key': apiKey, Accept: 'application/json' }
  let payload: string | undefined

  if (form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    payload = new URLSearchParams(form).toString()
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: payload,
      cache: 'no-store',
      // Файл договора может весить несколько мегабайт, но висеть дольше 30 с
      // всё равно бессмысленно: пользователь ждёт ответа в интерфейсе.
      signal: AbortSignal.timeout(30_000),
    })
  } catch (e) {
    throw new PodpislonError(
      e instanceof Error && e.name === 'TimeoutError'
        ? 'Подпислон не ответил за 30 секунд'
        : 'Не удалось связаться с Подпислоном'
    )
  }

  const text = await response.text()

  if (!response.ok) {
    // 401 и 403 стоит объяснять человеческим языком: это самые частые ошибки
    // настройки, и «HTTP 401» в тосте ничего не подсказывает.
    if (response.status === 401) throw new PodpislonError('Подпислон не принял API-ключ', 401)
    if (response.status === 403) throw new PodpislonError('У ключа нет прав на это действие', 403)
    if (response.status === 429) throw new PodpislonError('Слишком часто обращаемся к Подпислону — повторите через минуту', 429)
    throw new PodpislonError(`Подпислон вернул ошибку ${response.status}: ${text.slice(0, 200)}`, response.status)
  }

  try {
    return JSON.parse(text) as T
  } catch {
    throw new PodpislonError('Подпислон вернул не JSON — возможно, сервис на обслуживании')
  }
}

/** Приводит телефон к формату +7XXXXXXXXXX, который сервис принимает без вопросов. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
    return `+7${digits.slice(1)}`
  }
  if (digits.length === 10) return `+7${digits}`
  return null
}

export interface AddDocumentParams {
  apiKey: string
  /** Имя, фамилия и телефон обязательны — сервис подписывает именно физлицо. */
  name: string
  lastName: string
  secondName?: string | null
  phone: string
  files: { fileName: string; content: Buffer }[]
  /** 'Y' — не отправлять СМС, а вернуть ссылку для самостоятельной отправки. */
  withoutSms?: boolean
  /** Куда вернуть клиента после подписания. */
  redirectUrl?: string | null
}

export interface AddDocumentResult {
  ids: number[]
  links: string[]
}

/**
 * Отправляет документ(ы) на подпись.
 *
 * Файлы уходят JSON-ом в base64, а не multipart: в JSON-варианте имена файлов
 * передаются явным массивом fileName, и не нужно угадывать, как backend на Yii
 * назовёт поля массива в multipart (file[] или file).
 */
export async function addDocument(params: AddDocumentParams): Promise<AddDocumentResult> {
  const phone = normalizePhone(params.phone)
  if (!phone) throw new PodpislonError('Телефон подписанта указан в неверном формате')
  if (params.files.length === 0) throw new PodpislonError('Нечего отправлять — нет файлов')

  const body: Record<string, unknown> = {
    name: params.name,
    last_name: params.lastName,
    phone,
    // Обязательное поле сервиса: подтверждение согласия клиента на обработку
    // персональных данных. Согласие мы получаем сами (см. lib/pdf/consents).
    agreement: 'Y',
    file: params.files.map((f) => f.content.toString('base64')),
    fileName: params.files.map((f) => f.fileName),
  }
  if (params.secondName) body.second_name = params.secondName
  if (params.withoutSms) body.no_sms = 'Y'
  if (params.redirectUrl) body.redirect_url = params.redirectUrl

  const response = await request<{ status?: boolean; result?: unknown; message?: string }>({
    apiKey: params.apiKey,
    path: '/add-document',
    method: 'PUT',
    body,
  })

  if (response.status === false) {
    throw new PodpislonError(response.message || 'Подпислон отклонил документ')
  }

  const result = response.result

  if (typeof result === 'number') return { ids: [result], links: [] }
  if (Array.isArray(result)) return { ids: result.filter((v): v is number => typeof v === 'number'), links: [] }
  if (result && typeof result === 'object') {
    const object = result as { ids?: unknown; links?: unknown }
    return {
      ids: Array.isArray(object.ids) ? object.ids.filter((v): v is number => typeof v === 'number') : [],
      links: Array.isArray(object.links) ? object.links.filter((v): v is string => typeof v === 'string') : [],
    }
  }

  throw new PodpislonError('Подпислон не вернул идентификатор документа')
}

/** Список документов по их идентификаторам — им же проверяем статус подписания. */
export async function getDocuments(apiKey: string, ids: number[]): Promise<PodpislonDocument[]> {
  const response = await request<PodpislonDocument[] | { status?: boolean; result?: PodpislonDocument[] }>({
    apiKey,
    path: '/?expand=package',
    method: 'POST',
    body: { ids },
  })

  // Спецификация обещает массив, но обёртка {status, result} встречается
  // у соседних методов — принимаем оба варианта, чтобы не падать на ровном месте.
  if (Array.isArray(response)) return response
  if (Array.isArray(response.result)) return response.result
  return []
}

/** Подписанный PDF — сервис отдаёт его в base64. */
export async function getSignedFile(apiKey: string, id: number): Promise<Buffer> {
  const response = await request<{ status?: boolean; result?: string }>({
    apiKey,
    path: '/get-file',
    method: 'POST',
    form: { id: String(id) },
  })

  if (!response.result) throw new PodpislonError('Подпислон не вернул файл документа')
  return Buffer.from(response.result, 'base64')
}

/** Данные компании — используем как проверку ключа на странице настроек. */
export async function getCompanyInfo(apiKey: string): Promise<PodpislonCompany> {
  const response = await request<PodpislonCompany | { status?: boolean; result?: PodpislonCompany }>({
    apiKey,
    path: '/get-info',
  })

  if (response && typeof response === 'object' && 'result' in response && response.result) {
    return response.result as PodpislonCompany
  }
  return response as PodpislonCompany
}

/** Переотправляет клиенту ссылку на подписание (не более 5 раз — ограничение сервиса). */
export async function resendPackage(apiKey: string, packageId: string): Promise<void> {
  await request({ apiKey, path: `/resend/${encodeURIComponent(packageId)}`, method: 'POST' })
}

/** Статус документа в Подпислоне → статус записи contract_signatures. */
export function mapPodpislonStatus(status: string | undefined): 'pending' | 'viewed' | 'signed' | 'declined' {
  switch (status) {
    case PODPISLON_STATUS.opened:
      return 'viewed'
    case PODPISLON_STATUS.signed:
      return 'signed'
    case PODPISLON_STATUS.revoked:
      return 'declined'
    default:
      return 'pending'
  }
}
