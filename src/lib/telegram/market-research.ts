// "Мультиагент" (см. multiagentScreen() в menu.ts) — MVP делегированного исследования:
// пользователь задаёт составную задачу ("сравни наши цены на аренду 2к в районе Х с рынком"),
// бот прогоняет её через модель с включённым веб-поиском (тот же приём ":online", что и
// у рубрики "аналитика" в channel-generate.ts) и возвращает готовую сводку с источниками.
// Это НЕ настоящий multi-agent framework (нет отдельных агентов/оркестратора) — сознательно
// простой, production-ready первый шаг вместо очередной заглушки; расширять до реального
// разбиения на подзадачи имеет смысл только когда станет тесно одному вызову с веб-поиском.

const SYSTEM_PROMPT = `Ты — исследовательский модуль внутри Telegram-бота HousePro CRM (агентство недвижимости).
Тебе дают составную задачу на анализ рынка недвижимости или смежных тем — используй веб-поиск,
чтобы найти актуальные данные, и сведи их в чёткую сводку.

Правила:
- Отвечай на русском, по-деловому, без воды.
- Если нашёл конкретные цифры (цены, ставки, сроки) — обязательно укажи, откуда они и на какую дату.
- Если по теме мало актуальных данных — честно скажи об этом, не выдумывай цифры.
- Структура: 1-2 абзаца вывода в начале, затем при необходимости — детали по пунктам.
- В конце — короткий список источников (домены сайтов, без длинных URL).

Форматирование — Telegram HTML (НЕ markdown): разрешены только <b>, <i>, <code>, списки через "•".
Никаких markdown-таблиц и ### заголовков. Не используй "<", ">", "&" вне тегов.
Уложись в ~1500 символов — это сообщение в чат, не отчёт.`

export async function runMarketResearch(topic: string): Promise<string> {
  const baseModel = process.env.OPENROUTER_MODEL ?? 'anthropic/claude-sonnet-5'
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: `${baseModel}:online`,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: topic },
      ],
    }),
  })

  if (!res.ok) {
    throw new Error(`OpenRouter ${res.status}: ${await res.text()}`)
  }
  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content
  if (!text || typeof text !== 'string') throw new Error('Модель вернула пустой ответ')
  return text.trim()
}
