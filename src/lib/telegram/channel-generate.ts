import type { ChannelSettings } from '@/lib/telegram/channel'

// Форматирование поста — те же правила Telegram HTML, что и в основном боте
// (см. SYSTEM_PROMPT в webhook route.ts): только <b>/<i>/<code>, никаких markdown-таблиц,
// списки через "•".
const FORMAT_RULES = `Форматирование (Telegram HTML, НЕ markdown):
- Разрешены только <b>, <i>, <code>. Никаких ### заголовков и markdown-таблиц.
- Списки — через "•".
- Не используй "<", ">", "&" в свободном тексте (ломает разметку).
- Пост для канала агентства недвижимости: длина 400-900 символов, без лишней воды.
- Не подписывай пост именем — просто текст поста, без "Пост:" в начале.`

async function callOpenRouter(systemPrompt: string, userPrompt: string, useWebSearch: boolean): Promise<string> {
  const baseModel = process.env.OPENROUTER_MODEL ?? 'anthropic/claude-sonnet-5'
  // Суффикс ":online" — способ OpenRouter подключить веб-поиск к любой модели
  // без отдельного провайдера (Tavily под капотом). Нужен только для рубрики "аналитика".
  const model = useWebSearch ? `${baseModel}:online` : baseModel

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  })

  if (!res.ok) {
    throw new Error(`OpenRouter ${res.status}: ${await res.text()}`)
  }
  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content
  if (!text || typeof text !== 'string') throw new Error('OpenRouter вернул пустой ответ')
  return text.trim()
}

function baseSystemPrompt(settings: ChannelSettings | null): string {
  const style = settings?.style_prompt ?? 'Деловой, экспертный, дружелюбный тон.'
  return `Ты пишешь посты для Telegram-канала агентства недвижимости HousePro. Тон: ${style}
${FORMAT_RULES}`
}

export async function generateAnalyticsDraft(settings: ChannelSettings | null): Promise<string> {
  const system = baseSystemPrompt(settings)
  const user = `Напиши пост-аналитику по рынку недвижимости (актуальные тренды, цены, ставки ипотеки,
изменения в законодательстве — то, что реально происходит СЕЙЧАС, а не общие рассуждения).
Используй свежие данные из веб-поиска. В конце — короткий вывод, что это значит для тех,
кто сейчас покупает/продаёт/сдаёт недвижимость. Без CTA в конце — его добавит система отдельно.`
  return callOpenRouter(system, user, true)
}

export async function generateCtaDraft(settings: ChannelSettings | null, offerHint?: string): Promise<string> {
  const system = baseSystemPrompt(settings)
  const user = offerHint
    ? `Напиши продающий пост-оффер на основе этой вводной: ${offerHint}`
    : `Напиши продающий пост-оффер общего плана — предложи услуги агентства недвижимости
(подбор объекта, сопровождение сделки, оценка перед продажей). Сделай конкретный, не расплывчатый оффер,
с понятной причиной написать прямо сейчас. Без явного CTA-текста в конце ("напишите в личку" и т.п.) —
призыв к действию добавит система отдельно, ниже основного текста.`
  return callOpenRouter(system, user, false)
}

// Картинка — иллюстративная, НЕ инфографика с цифрами (модель рисует картинки, не диаграммы,
// и придуманные на картинке цифры выглядели бы как реальная статистика — риск дезинформации).
// Для рубрики "аналитика" в перспективе можно добавить отдельный рендер реального графика
// по данным веб-поиска (canvas/QuickChart) — здесь сознательно не делаем, чтобы не путать
// сгенерированную иллюстрацию с настоящей статистикой.
export async function generateChannelImage(rubric: string, postText: string): Promise<Buffer | null> {
  const model = process.env.OPENROUTER_IMAGE_MODEL ?? 'google/gemini-2.5-flash-image'
  const styleHint =
    'Фотореалистичный современный стиль, тёплый естественный свет, без текста и надписей на картинке, ' +
    'без логотипов и водяных знаков, горизонтальная ориентация 16:9.'
  const topicHint = postText.slice(0, 300)

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
    body: JSON.stringify({
      model,
      modalities: ['image', 'text'],
      messages: [
        {
          role: 'user',
          content: `Нарисуй обложку для поста в Telegram-канале агентства недвижимости (рубрика: ${rubric}).
Тема поста: ${topicHint}
${styleHint}`,
        },
      ],
    }),
  })

  if (!res.ok) {
    console.error('[channel-generate] image generation failed:', res.status, await res.text())
    return null
  }

  const data = await res.json()
  const dataUrl: string | undefined = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url
  if (!dataUrl?.startsWith('data:image')) {
    console.error('[channel-generate] image generation: неожиданный формат ответа', JSON.stringify(data).slice(0, 300))
    return null
  }

  const base64 = dataUrl.split(',')[1]
  return Buffer.from(base64, 'base64')
}

export async function generateAdhocDraft(settings: ChannelSettings | null, topic: string): Promise<string> {
  const system = baseSystemPrompt(settings)
  const user = `Напиши пост на тему: "${topic}". Если тема требует актуальных фактов — используй веб-поиск,
не выдумывай цифры. Без явного CTA в конце — его добавит система отдельно.`
  return callOpenRouter(system, user, true)
}

// Кейс собирается ИЗ надиктовки/текста от Руслана — не выдумывается моделью.
// Задача модели — только литературно оформить вводные в связный пост, не придумывая деталей.
export async function generateCaseDraft(settings: ChannelSettings | null, rawInput: string): Promise<string> {
  const system = `${baseSystemPrompt(settings)}

КРИТИЧЕСКИ ВАЖНО: используй ТОЛЬКО факты, которые реально есть во вводных ниже. Ничего не придумывай —
ни цифры, ни детали, ни цитаты клиента. Если каких-то деталей не хватает для связного рассказа —
просто опусти их, не заполняй фантазией. Структура кейса: с чем пришёл клиент → в чём была сложность →
как решили → результат.`
  const user = `Вводные (голосовая надиктовка или текст от агента): "${rawInput}"

Оформи это в пост-кейс для канала.`
  return callOpenRouter(system, user, false)
}
