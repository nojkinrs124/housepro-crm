// Инструменты для LLM-бота. Формат — OpenAI function-calling (OpenRouter отдаёт
// tool_calls в этом формате вне зависимости от того, какая модель роутится под капотом,
// это НЕ нативный Anthropic messages/tools формат).
//
// Мутирующие инструменты (MUTATING_TOOLS) не выполняются здесь напрямую — вебхук
// перехватывает их до вызова dispatchTool() и заводит запись в bot_pending_actions,
// ждёт подтверждения "да" от пользователя в Telegram.

import { ALL_STAGE_VALUES, DIRECTION_VALUES } from '@/features/directions/config/directions'

export const MUTATING_TOOLS = [
  'add_transaction',
  'update_deal_status',
  'generate_contract',
  'create_lead',
  'create_property',
  'update_property_status',
  'create_contact',
  'update_contact',
  'import_rental_contract',
  'create_task',
  'complete_task',
] as const

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
      description: 'Получить список сделок с фильтрами по стадии, направлению и дате.',
      parameters: {
        type: 'object',
        properties: {
          // Список стадий берётся из конфига направлений: своя копия здесь
          // осталась на старых шести стадиях, и модель предлагала бы
          // `negotiation`, которого больше нет ни в одной воронке.
          status: { type: 'string', enum: ALL_STAGE_VALUES },
          deal_type: { type: 'string', enum: DIRECTION_VALUES, description: 'Направление работы' },
          limit: { type: 'number', description: 'Максимум записей, по умолчанию 20' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_deal_status',
      description: 'Изменить стадию сделки. Стадия должна относиться к направлению сделки: у аренды, управления, продажи и подбора разные воронки. МУТИРУЮЩЕЕ действие — требует подтверждения пользователя.',
      parameters: {
        type: 'object',
        properties: {
          deal_id: { type: 'string', description: 'UUID сделки' },
          // Стадия должна принадлежать направлению сделки — это проверяет
          // обработчик, здесь только общий список допустимых значений.
          status: { type: 'string', enum: ALL_STAGE_VALUES },
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
  {
    type: 'function',
    function: {
      name: 'create_lead',
      description: 'Создать новый лид/заявку. МУТИРУЮЩЕЕ действие — требует подтверждения пользователя.',
      parameters: {
        type: 'object',
        properties: {
          full_name: { type: 'string' },
          phone: { type: 'string' },
          email: { type: 'string' },
          deal_type: { type: 'string', enum: ['rent', 'sale', 'commercial'] },
          comment: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_property',
      description: 'Добавить новый объект недвижимости. МУТИРУЮЩЕЕ действие — требует подтверждения.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Короткое название, например "2к на Ленина 10"' },
          property_type: { type: 'string', enum: ['apartment', 'house', 'commercial', 'office', 'warehouse', 'land'] },
          deal_type: { type: 'string', enum: ['rent', 'sale', 'management', 'subrent'] },
          address: { type: 'string' },
          district: { type: 'string' },
          price: { type: 'number' },
          deposit: { type: 'number' },
          area: { type: 'number' },
          rooms: { type: 'number' },
          floor: { type: 'number' },
          description: { type: 'string' },
        },
        required: ['title', 'property_type', 'deal_type', 'address'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_property_status',
      description: 'Изменить статус объекта недвижимости (сдан/продан/доступен и т.п.). МУТИРУЮЩЕЕ действие.',
      parameters: {
        type: 'object',
        properties: {
          property_id: { type: 'string', description: 'UUID объекта' },
          status: { type: 'string', enum: ['available', 'reserved', 'rented', 'sold', 'inactive'] },
        },
        required: ['property_id', 'status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_contact',
      description: 'Создать нового клиента/контакт (не лид, а именно контакт — владелец, клиент и т.п.). МУТИРУЮЩЕЕ действие.',
      parameters: {
        type: 'object',
        properties: {
          full_name: { type: 'string' },
          phone: { type: 'string' },
          email: { type: 'string' },
          role: { type: 'string', enum: ['client', 'owner', 'both'] },
          passport_series: { type: 'string' },
          passport_number: { type: 'string' },
          passport_issued_date: { type: 'string', description: 'YYYY-MM-DD' },
          passport_issued_by: { type: 'string' },
          passport_department_code: { type: 'string' },
          birth_date: { type: 'string', description: 'YYYY-MM-DD' },
          country: { type: 'string' },
          region: { type: 'string' },
          city: { type: 'string' },
          street: { type: 'string' },
          house_number: { type: 'string' },
          building: { type: 'string' },
          apartment: { type: 'string' },
        },
        required: ['full_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_contact',
      description:
        'Обновить данные существующего контакта — паспорт, адрес регистрации, телефон, email и т.п. ' +
        'Используй, когда нужно дополнить уже созданный контакт (например, паспортными данными для договора). ' +
        'МУТИРУЮЩЕЕ действие. Если не знаешь contact_id — сначала найди контакт через get_client.',
      parameters: {
        type: 'object',
        properties: {
          contact_id: { type: 'string', description: 'UUID контакта' },
          full_name: { type: 'string' },
          phone: { type: 'string' },
          email: { type: 'string' },
          passport_series: { type: 'string' },
          passport_number: { type: 'string' },
          passport_issued_date: { type: 'string', description: 'YYYY-MM-DD' },
          passport_issued_by: { type: 'string' },
          passport_department_code: { type: 'string' },
          birth_date: { type: 'string', description: 'YYYY-MM-DD' },
          country: { type: 'string' },
          region: { type: 'string' },
          city: { type: 'string' },
          street: { type: 'string' },
          house_number: { type: 'string' },
          building: { type: 'string' },
          apartment: { type: 'string' },
        },
        required: ['contact_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'import_rental_contract',
      description:
        'Разобрать договор аренды (или похожий документ) и ОДНИМ вызовом создать/связать: ' +
        'собственника, арендатора, объект недвижимости и сделку между ними. Используй это ' +
        'вместо create_contact/create_property по отдельности, когда из одного документа/сообщения ' +
        'нужно завести НЕСКОЛЬКО связанных сущностей сразу (это единственный способ действительно ' +
        'связать их друг с другом — owner_id, client_contact_id и т.п. проставляются автоматически). ' +
        'Если в документе не хватает каких-то данных — передавай только то, что есть, остальное можно ' +
        'дополнить потом через update_contact/update_property_status. МУТИРУЮЩЕЕ действие.',
      parameters: {
        type: 'object',
        properties: {
          owner: {
            type: 'object',
            description: 'Собственник объекта',
            properties: {
              full_name: { type: 'string' },
              phone: { type: 'string' },
              email: { type: 'string' },
              passport_series: { type: 'string' },
              passport_number: { type: 'string' },
              passport_issued_date: { type: 'string' },
              passport_issued_by: { type: 'string' },
              passport_department_code: { type: 'string' },
              country: { type: 'string' },
              region: { type: 'string' },
              city: { type: 'string' },
              street: { type: 'string' },
              house_number: { type: 'string' },
              building: { type: 'string' },
              apartment: { type: 'string' },
            },
            required: ['full_name'],
          },
          tenant: {
            type: 'object',
            description: 'Арендатор',
            properties: {
              full_name: { type: 'string' },
              phone: { type: 'string' },
              email: { type: 'string' },
              passport_series: { type: 'string' },
              passport_number: { type: 'string' },
              passport_issued_date: { type: 'string' },
              passport_issued_by: { type: 'string' },
              passport_department_code: { type: 'string' },
              country: { type: 'string' },
              region: { type: 'string' },
              city: { type: 'string' },
              street: { type: 'string' },
              house_number: { type: 'string' },
              building: { type: 'string' },
              apartment: { type: 'string' },
            },
            required: ['full_name'],
          },
          property: {
            type: 'object',
            description: 'Объект недвижимости',
            properties: {
              title: { type: 'string' },
              property_type: { type: 'string', enum: ['apartment', 'house', 'commercial', 'office', 'warehouse', 'land'] },
              deal_type: { type: 'string', enum: ['rent', 'sale', 'management', 'subrent'] },
              address: { type: 'string' },
              district: { type: 'string' },
              price: { type: 'number' },
              deposit: { type: 'number' },
              area: { type: 'number' },
              rooms: { type: 'number' },
              floor: { type: 'number' },
            },
            required: ['title', 'property_type', 'deal_type', 'address'],
          },
          deal: {
            type: 'object',
            description: 'Параметры сделки (опционально — статус по умолчанию "contract")',
            properties: {
              deal_type: { type: 'string' },
              status: { type: 'string' },
              amount: { type: 'number' },
              notes: { type: 'string' },
            },
          },
        },
        required: ['owner', 'tenant', 'property'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_channel_post',
      description:
        'Сгенерировать разовый пост для Telegram-канала @housepro24 по заданной теме (с иллюстрацией, ' +
        'с веб-поиском при необходимости) и отправить на утверждение кнопками в этот же чат. ' +
        'НЕ публикует сразу — только готовит черновик.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'Тема поста, например "новые правила ипотеки" или "аренда апартаментов в центре"' },
        },
        required: ['topic'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_channel_stats',
      description: 'Статистика Telegram-канала @housepro24 прямо сейчас: подписчики, посты и клики по CTA за 7 дней, черновики на утверждении.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_tasks',
      description:
        'Получить список открытых задач (todo/in_progress). Используй для "что горит", ' +
        '"какие задачи на сегодня/просрочены" — передай due_before = сегодняшняя дата.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['todo', 'in_progress', 'done', 'cancelled'] },
          due_before: { type: 'string', description: 'YYYY-MM-DD — вернуть задачи со сроком до этой даты включительно' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_task',
      description:
        'Поставить новую задачу (себе или на команду — без конкретного исполнителя, поле есть на будущее). ' +
        'МУТИРУЮЩЕЕ действие — требует подтверждения пользователя.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] },
          deadline: { type: 'string', description: 'YYYY-MM-DD' },
          deal_id: { type: 'string', description: 'UUID сделки, если задача привязана к сделке' },
          lead_id: { type: 'string', description: 'UUID лида, если задача привязана к лиду' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'complete_task',
      description: 'Отметить задачу выполненной. МУТИРУЮЩЕЕ действие — требует подтверждения пользователя.',
      parameters: {
        type: 'object',
        properties: { task_id: { type: 'string', description: 'UUID задачи' } },
        required: ['task_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_overdue_payments',
      description: 'Список неоплаченных/просроченных/частично оплаченных платежей. Read-only.',
      parameters: {
        type: 'object',
        properties: { status: { type: 'string', enum: ['pending', 'overdue', 'partial', 'paid', 'cancelled'] } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_finance_chart',
      description:
        'Построить и отправить в чат настоящий график (не иллюстрацию) доходов/расходов/прибыли по месяцам ' +
        'за последние несколько месяцев — реальные цифры из бухгалтерии, не выдумка модели. Read-only, ' +
        'отправляет картинку напрямую в чат, тебе не нужно пересказывать цифры текстом после вызова.',
      parameters: {
        type: 'object',
        properties: { months: { type: 'number', description: 'Сколько последних месяцев показать, по умолчанию 6' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'market_research',
      description:
        'Делегировать составную исследовательскую задачу по рынку недвижимости или смежной теме — ' +
        'с веб-поиском (например: "сравни наши цены на аренду 2к на Ленина с рынком в этом районе", ' +
        '"какие новые правила ипотеки вступают в силу"). Read-only, ничего не меняет в CRM, только ищет ' +
        'и суммирует информацию. Может занять до минуты.',
      parameters: {
        type: 'object',
        properties: { topic: { type: 'string', description: 'Что именно исследовать' } },
        required: ['topic'],
      },
    },
  },
] as const

/** Выполняет read-only инструмент. Мутирующие сюда не должны попадать — их перехватывает вебхук.
 * ctx.chatId нужен только инструментам, которые сами шлют сообщение в чат (график, картинки) —
 * их результат для модели это короткое подтверждение, а не данные для пересказа текстом. */
export async function dispatchReadOnlyTool(name: string, args: Record<string, unknown>, ctx: { chatId: number }) {
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
    case 'create_channel_post': {
      const { resolveBotOrgId } = await import('@/lib/telegram/org')
      const { createDraftRow, sendDraftForReview, getChannelSettings, getRubricByKey } = await import('@/lib/telegram/channel')
      const { generateRubricDraft } = await import('@/lib/telegram/channel-generate')
      const orgId = await resolveBotOrgId()
      if (!orgId) return { error: 'Не удалось определить организацию' }
      const settings = await getChannelSettings(orgId)
      const topic = String(args.topic ?? '').trim()
      if (!topic) return { error: 'Не указана тема поста' }
      const rubric = await getRubricByKey(orgId, 'adhoc')
      if (!rubric) return { error: 'Рубрика «adhoc» не найдена в БД' }
      const text = await generateRubricDraft(settings, rubric, topic)
      const postId = await createDraftRow(orgId, 'adhoc', null, { rubricId: rubric.id })
      await sendDraftForReview(orgId, postId, 'adhoc', text, 'none')
      return { status: 'Черновик отправлен на утверждение кнопками в этот чат', postId }
    }
    case 'get_channel_stats': {
      const { resolveBotOrgId } = await import('@/lib/telegram/org')
      const { getChannelSettings, getLiveStatsText } = await import('@/lib/telegram/channel')
      const orgId = await resolveBotOrgId()
      if (!orgId) return { error: 'Не удалось определить организацию' }
      const settings = await getChannelSettings(orgId)
      if (!settings) return { error: 'Настройки канала не заведены' }
      return { text: await getLiveStatsText(orgId, settings) }
    }
    case 'list_tasks': {
      const params = new URLSearchParams()
      if (args.status) params.set('status', String(args.status))
      if (args.due_before) params.set('due_before', String(args.due_before))
      return callApi(`/api/v1/tasks?${params.toString()}`)
    }
    case 'list_overdue_payments': {
      const params = new URLSearchParams()
      if (args.status) params.set('status', String(args.status))
      return callApi(`/api/v1/payments?${params.toString()}`)
    }
    case 'get_finance_chart': {
      const { sendPhoto, sendChatAction } = await import('@/lib/telegram/api')
      const { buildFinanceChartUrl } = await import('@/lib/telegram/charts')
      const months = Math.min(Math.max(Number(args.months) || 6, 1), 12)

      const from = new Date()
      from.setMonth(from.getMonth() - (months - 1))
      from.setDate(1)
      const dateFrom = from.toISOString().slice(0, 10)

      const result = await callApi(`/api/v1/accounting/transactions?date_from=${dateFrom}&limit=200`)
      if (result?.error) return result
      const transactions = (result?.data ?? []) as Array<{ type: string; amount: number; date: string }>

      const buckets = new Map<string, { income: number; expense: number }>()
      for (let i = 0; i < months; i++) {
        const d = new Date(from)
        d.setMonth(d.getMonth() + i)
        buckets.set(d.toISOString().slice(0, 7), { income: 0, expense: 0 })
      }
      for (const t of transactions) {
        const key = String(t.date).slice(0, 7)
        const bucket = buckets.get(key)
        if (!bucket) continue
        if (t.type === 'income') bucket.income += Number(t.amount)
        else bucket.expense += Number(t.amount)
      }

      const labels = [...buckets.keys()].map((k) => {
        const [y, m] = k.split('-')
        return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' })
      })
      const income = [...buckets.values()].map((b) => Math.round(b.income))
      const expense = [...buckets.values()].map((b) => Math.round(b.expense))

      await sendChatAction(ctx.chatId, 'upload_photo')
      const url = buildFinanceChartUrl(labels, income, expense)
      await sendPhoto(ctx.chatId, url, `Финансы за последние ${months} мес.`)
      return { status: 'График отправлен в чат картинкой, повторно текстом цифры не нужны' }
    }
    case 'market_research': {
      const { runMarketResearch } = await import('@/lib/telegram/market-research')
      const topic = String(args.topic ?? '').trim()
      if (!topic) return { error: 'Не указана тема исследования' }
      try {
        const text = await runMarketResearch(topic)
        return { result: text }
      } catch (e) {
        return { error: e instanceof Error ? e.message : 'Не удалось выполнить исследование' }
      }
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
    case 'create_lead':
      return callApi('/api/v1/leads', { method: 'POST', body: JSON.stringify(payload) })
    case 'create_property':
      return callApi('/api/v1/properties', { method: 'POST', body: JSON.stringify(payload) })
    case 'update_property_status':
      return callApi(`/api/v1/properties?id=${encodeURIComponent(String(payload.property_id))}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: payload.status }),
      })
    case 'create_contact':
      return callApi('/api/v1/contacts', { method: 'POST', body: JSON.stringify(payload) })
    case 'update_contact': {
      const { contact_id, ...fields } = payload
      return callApi(`/api/v1/contacts/${encodeURIComponent(String(contact_id))}`, {
        method: 'PUT',
        body: JSON.stringify(fields),
      })
    }
    case 'import_rental_contract':
      return callApi('/api/v1/import/rental-contract', { method: 'POST', body: JSON.stringify(payload) })
    case 'create_task':
      return callApi('/api/v1/tasks', { method: 'POST', body: JSON.stringify(payload) })
    case 'complete_task':
      return callApi(`/api/v1/tasks?id=${encodeURIComponent(String(payload.task_id))}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'done' }),
      })
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
    case 'create_lead':
      return `👤 Новый лид: ${args.full_name ?? '(без имени)'}${args.phone ? `, ${args.phone}` : ''}`
    case 'create_property':
      return `🏠 Новый объект: ${args.title}, ${args.address}`
    case 'update_property_status':
      return `🏠 Изменить статус объекта ${args.property_id} → ${args.status}`
    case 'create_contact':
      return `👤 Новый контакт: ${args.full_name}${args.phone ? `, ${args.phone}` : ''}`
    case 'update_contact': {
      const fields = Object.keys(args).filter((k) => k !== 'contact_id')
      return `✏️ Обновить контакт ${args.contact_id}: ${fields.join(', ')}`
    }
    case 'import_rental_contract': {
      const owner = args.owner as Record<string, unknown> | undefined
      const tenant = args.tenant as Record<string, unknown> | undefined
      const property = args.property as Record<string, unknown> | undefined
      return (
        `📥 Импорт договора аренды:\n` +
        `• Собственник: ${owner?.full_name ?? '?'}${owner?.phone ? `, ${owner.phone}` : ''}\n` +
        `• Арендатор: ${tenant?.full_name ?? '?'}${tenant?.phone ? `, ${tenant.phone}` : ''}\n` +
        `• Объект: ${property?.title ?? '?'}, ${property?.address ?? ''}\n` +
        `→ создаст 2 контакта, объект и сделку, всё связав между собой`
      )
    }
    case 'create_task':
      return `✅ Новая задача: ${args.title}${args.deadline ? ` — срок ${args.deadline}` : ''}`
    case 'complete_task':
      return `☑️ Отметить задачу выполненной: ${args.task_id}`
    default:
      return `Действие: ${actionType}`
  }
}
