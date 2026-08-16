import type { ChannelSettings } from '@/lib/telegram/channel'

// Форматирование поста — те же правила Telegram HTML, что и в основном боте
// (см. SYSTEM_PROMPT в webhook route.ts): только <b>/<i>/<code>, никаких markdown-таблиц,
// списки через "•".
const MAX_POST_CHARS = 900 // с запасом от лимита подписи к фото в 1024 (ссылка/эмодзи добавляются потом)

const FORMAT_RULES = `Форматирование (Telegram HTML, НЕ markdown):
- Разрешены только <b>, <i>, <code>. Никаких ### заголовков и markdown-таблиц.
- Списки — через "•".
- Не используй "<", ">", "&" в свободном тексте (ломает разметку).
- Используй эмодзи к месту (1-3 на пост) — как акценты в начале смысловых блоков или в заголовке,
  не как украшение через слово. Пост для агентства недвижимости — эмодзи уместные, не кричащие.
- Разбивай текст на смысловые абзацы пустой строкой между ними — не сплошной "простынёй".
  2-4 абзаца по 1-3 предложения — комфортно читать с телефона.
- <b>Жирным</b> — только 1-2 ключевые фразы на весь пост (главная цифра, вывод), не подряд идущие слова.
- Пост для канала агентства недвижимости: СТРОГО не длиннее ${MAX_POST_CHARS} символов (считая пробелы,
  без учёта тегов), без лишней воды. Это жёсткий лимит — влезает в подпись к фото в Telegram.
- Не подписывай пост именем — просто текст поста, без "Пост:" в начале.`

// Модель иногда всё равно превышает лимит — режем по последней точке/переносу строки перед лимитом,
// чтобы не обрывать предложение на середине слова.
export function enforcePostLength(text: string, maxChars = MAX_POST_CHARS): string {
  if (text.length <= maxChars) return text
  const cut = text.slice(0, maxChars)
  const lastBreak = Math.max(cut.lastIndexOf('\n\n'), cut.lastIndexOf('. '), cut.lastIndexOf('!'), cut.lastIndexOf('?'))
  return (lastBreak > maxChars * 0.6 ? cut.slice(0, lastBreak + 1) : cut).trim()
}

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
  return enforcePostLength(text.trim())
}

function baseSystemPrompt(settings: ChannelSettings | null): string {
  const style = settings?.style_prompt ?? 'Деловой, экспертный, дружелюбный тон.'
  return `Ты пишешь посты для Telegram-канала агентства недвижимости HousePro. Тон: ${style}
${FORMAT_RULES}`
}

// Убирает цифры/проценты/деньги из текста поста перед тем, как отдать его модели как
// "тему" картинки. Без этого модель видит "128,1 тыс. руб/м²" в теме и пытается нарисовать
// инфографику с этими цифрами текстом — а рисовать читаемый текст (тем более кириллицу)
// она не умеет, получается нечитаемая кракозябра поверх картинки.
function stripNumbersForImagePrompt(text: string): string {
  return text
    .replace(/[+-]?\d[\d\s.,]*\s*(%|₽|руб\.?|тыс\.?|млн\.?|млрд\.?|м²|м2|кв\.?\s*м)?/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// Для рубрики "аналитика" тема поста почти всегда числа/сравнения ("купить или снять",
// динамика цен) — именно это провоцирует модель рисовать псевдо-инфографику с цифрами.
// Поэтому для этой рубрики не используем текст поста как тему картинки вообще, а даём
// заведомо безопасную абстрактную сцену без чисел и сравнений.
function imageTopicHint(rubric: string, postText: string): string {
  if (rubric === 'analytics') {
    return 'Рынок недвижимости: современный жилой квартал на закате, ключи от новой квартиры на столе, ' +
      'силуэт города — без графиков, без диаграмм, без сравнений "было/стало".'
  }
  return stripNumbersForImagePrompt(postText).slice(0, 250)
}

// Картинка — иллюстративная, НЕ инфографика с цифрами (модель рисует картинки, не диаграммы,
// и придуманные на картинке цифры выглядели бы как реальная статистика — риск дезинформации).
// Для рубрики "аналитика" в перспективе можно добавить отдельный рендер реального графика
// по данным веб-поиска (canvas/QuickChart) — здесь сознательно не делаем, чтобы не путать
// сгенерированную иллюстрацию с настоящей статистикой.
export async function generateChannelImage(rubric: string, postText: string, extraInstruction?: string): Promise<Buffer | null> {
  const model = process.env.OPENROUTER_IMAGE_MODEL ?? 'google/gemini-2.5-flash-image'
  const styleHint =
    'Фотореалистичный современный стиль, тёплый естественный свет, горизонтальная ориентация 16:9, ' +
    'без логотипов и водяных знаков.\n' +
    'КРИТИЧЕСКИ ВАЖНО: на изображении НЕ должно быть вообще никакого текста — ни букв, ни цифр, ' +
    'ни заголовков, ни подписей, ни ценников, ни диаграмм, ни графиков, ни инфографики. Ничего похожего ' +
    'на типографику, даже размыто или декоративно. Это должна быть чистая фотографическая/иллюстративная ' +
    'сцена без единого символа текста. Если тянет добавить заголовок или цифры — вместо этого добавь ' +
    'больше архитектуры, света, людей или предметов, но не текст.\n' +
    'CRITICAL: absolutely no text, letters, numbers, captions, labels, signage, price tags, charts, graphs ' +
    'or infographic elements anywhere in the image. No typography of any kind, not even blurred or stylized.'
  const topicHint = imageTopicHint(rubric, postText)
  const preferenceHint = extraInstruction ? `\nДополнительные пожелания к картинке от заказчика: ${extraInstruction.trim()}` : ''

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
${styleHint}${preferenceHint}`,
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
    console.error('[channel-generate] image generation: неожиданный формат ответа', JSON.stringify(data).slice(0, 800))
    return null
  }

  const base64 = dataUrl.split(',')[1]
  return Buffer.from(base64, 'base64')
}

// Обобщённая генерация по рубрике из БД (channel_rubrics.prompt_template) — единая точка
// генерации черновиков, используется и heartbeat-кроном, и ручными путями (webhook.ts/
// tools.ts): кнопка "🔄 Другой текст", надиктовка кейса, разовый пост по теме.
// extraInput — вводные от админа (тема разового поста, надиктовка кейса), если рубрика
// requires_input; подставляются вторым абзацем к prompt_template.
export async function generateRubricDraft(
  settings: ChannelSettings | null,
  rubric: { prompt_template: string; use_web_search: boolean },
  extraInput?: string
): Promise<string> {
  const system = baseSystemPrompt(settings)
  const user = extraInput ? `${rubric.prompt_template}\n\nВводные от админа: "${extraInput.trim()}"` : rubric.prompt_template
  return callOpenRouter(system, user, rubric.use_web_search)
}
