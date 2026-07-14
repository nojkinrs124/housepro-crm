// Инструменты для LLM-бота. Формат — OpenAI function-calling (OpenRouter отдаёт
// tool_calls в этом формате вне зависимости от того, какая модель роутится под капотом,
// это НЕ нативный Anthropic messages/tools формат).
//
// Мутирующие инструменты (MUTATING_TOOLS) не выполняются здесь напрямую — вебхук
// перехватывает их до вызова dispatchTool() и заводит запись в bot_pending_actions,
// ждёт подтверждения "да" от пользователя в Telegram.

export const MUTATING_TOOLS = ['add_transaction', 'update_deal_status', 'generate_contract'] as const

function apiBase(): string {
  // NEXT_PUBLIC_SITE_URL — если явно задан (см. billing/checkout, тот же паттерн).
  // Иначе — автоматическая переменная Vercel (без протокола, поэтому https:// вручную).
  // localhost имеет смысл только при локальной разработке — на Vercel он не резолвится.
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

function botApiKey(): string {
  const key = process.env.HOUSEPRO_BOT_API_KEY
  if (!key) throw new Error('HOUSEPRO_BOT_API_KEY не задан в окружении')
  return key
}

async function callApi(path: string, init?: RequestInit) {
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${botApiKey()}`,
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { error: json.error ?? `HTTP ${res.status}`, details: json.details }
  }
  return json
}

export const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'get_deals',
      description: 'Получить список сделок с фильтрами по статусу, типу и дате.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['new', 'showing', 'negotiation', 'contract', 'payment', 'completed', 'cancelled'] },
          limit: { type: 'number', description: 'Максимум записей, по умолчанию 20' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_deal_status',
      description: 'Изменить статус сделки. МУТИРУЮЩЕЕ действие — требует подтверждения пользователя.',
      parameters: {
        type: 'object',
        properties: {
          deal_id: { type: 'string', description: 'UUID сделки' },
          status: { type: 'string', enum: ['new', 'showing', 'negotiation', 'contract', 'payment', 'completed', 'cancelled'] },
        },
        required: ['deal_id', 'status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_transaction',
      description: 'Добавить доход или расход в бухгалтерию. МУТИРУЮЩЕЕ действие — требует подтверждения пользователя.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['income', 'expense'] },
          amount: { type: 'number' },
          description: { type: 'string' },
          date: { type: 'string', description: 'YYYY-MM-DD, по умолчанию сегодня' },
        },
        required: ['type', 'amount'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_finance_summary',
      description: 'Получить сводку доходов/расходов/прибыли за период.',
      parameters: {
        type: 'object',
        properties: {
          date_from: { type: 'string', description: 'YYYY-MM-DD' },
          date_to: { type: 'string', description: 'YYYY-MM-DD' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_properties',
      description: 'Список объектов недвижимости с фильтрами.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          deal_type: { type: 'string', enum: ['rent', 'sale', 'management', 'commercial', 'subrent'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_client',
      description: 'Найти клиента/контакт по телефону, имени или telegram.',
      parameters: {
        type: 'object',
        properties: { search: { type: 'string' } },
        required: ['search'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_contract',
      description: 'Сгенерировать DOCX-файл договора по шаблону. МУТИРУЮЩЕЕ действие — требует подтверждения пользователя.',
      parameters: {
        type: 'object',
        properties: { contract_id: { type: 'string', description: 'UUID договора' } },
        required: ['contract_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_contract',
      description: 'Проверить договор на риски и пропущенные данные (юридический анализ). Read-only.',
      parameters: {
        type: 'object',
        properties: { contract_id: { type: 'string', description: 'UUID договора' } },
        required: ['contract_id'],
      },
    },
  },
] as const

/** Выполняет read-only инструмент. Мутирующие сюда не должны попадать — их перехватывает вебхук. */
export async function dispatchReadOnlyTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case 'get_deals': {
      const params = new URLSearchParams()
      if (args.status) params.set('status', String(args.status))
      if (args.limit) params.set('limit', String(args.limit))
      return callApi(`/api/v1/deals?${params.toString()}`)
    }
    case 'get_finance_summary': {
      const params = new URLSearchParams()
      if (args.date_from) params.set('date_from', String(args.date_from))
      if (args.date_to) params.set('date_to', String(args.date_to))
      params.set('limit', '200')
      return callApi(`/api/v1/accounting/transactions?${params.toString()}`)
    }
    case 'list_properties': {
      const params = new URLSearchParams()
      if (args.status) params.set('status', String(args.status))
      if (args.deal_type) params.set('deal_type', String(args.deal_type))
      return callApi(`/api/v1/properties?${params.toString()}`)
    }
    case 'get_client': {
      const params = new URLSearchParams()
      params.set('search', String(args.search ?? ''))
      return callApi(`/api/v1/contacts?${params.toString()}`)
    }
    case 'check_contract': {
      return callApi(`/api/v1/contracts/${encodeURIComponent(String(args.contract_id))}/check`, { method: 'POST' })
    }
    default:
      return { error: `Неизвестный read-only инструмент: ${name}` }
  }
}

/** Реально выполняет мутирующее действие ПОСЛЕ подтверждения пользователем (вызывается из callback_query хендлера). */
export async function executeConfirmedMutation(actionType: string, payload: Record<string, unknown>) {
  switch (actionType) {
    case 'add_transaction':
      return callApi('/api/v1/accounting/transactions', { method: 'POST', body: JSON.stringify(payload) })
    case 'update_deal_status':
      return callApi(`/api/v1/deals?id=${encodeURIComponent(String(payload.deal_id))}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: payload.status }),
      })
    case 'generate_contract':
      return callApi(`/api/v1/contracts/${encodeURIComponent(String(payload.contract_id))}/generate`, { method: 'POST' })
    default:
      return { error: `Неизвестное мутирующее действие: ${actionType}` }
  }
}

/** Человекочитаемое описание мутирующего действия для сообщения-подтверждения в Telegram. */
export function describeMutation(actionType: string, args: Record<string, unknown>): string {
  switch (actionType) {
    case 'add_transaction':
      return `${args.type === 'income' ? '💰 Доход' : '💸 Расход'}: ${args.amount} ₽${args.description ? ` — ${args.description}` : ''}`
    case 'update_deal_status':
      return `📋 Изменить статус сделки ${args.deal_id} → ${args.status}`
    case 'generate_contract':
      return `📄 Сгенерировать DOCX договора ${args.contract_id}`
    default:
      return `Действие: ${actionType}`
  }
}
