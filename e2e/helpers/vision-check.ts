/**
 * Отправляет скриншот в vision-модель через OpenRouter и просит вынести
 * вердикт: страница выглядит нормально, или на ней видна ошибка/крах/
 * пустой экран/что-то явно не так.
 *
 * Это НЕ замена детерминированным Playwright-ассертам (expect(locator))
 * — это дополнительный "человеческий глаз" поверх них, который ловит
 * визуальные регрессии, не завязанные на конкретный селектор:
 * съехавшую вёрстку, вылезший текст ошибки, пустой список там где должны
 * быть данные, битую иконку и т.п.
 */

const OPENROUTER_MODEL = process.env.OPENROUTER_VISION_MODEL || 'google/gemini-2.5-flash'

export interface VisionCheckResult {
  ok: boolean
  reason: string
  raw: string
}

export async function checkScreenshotWithVision(
  screenshotBase64: string,
  expectation: string
): Promise<VisionCheckResult> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY не задан — vision-проверка невозможна')
  }

  const prompt = `Ты — QA-инженер, проверяющий скриншот веб-приложения (CRM для риелторского агентства, интерфейс на русском).

Ожидание для этого шага: ${expectation}

Ответь СТРОГО в JSON, без markdown-обёртки, без преамбулы:
{"ok": true|false, "reason": "краткое объяснение на русском, 1-2 предложения"}

ok=false если видишь: текст ошибки/exception на экране, пустую страницу там где должны быть данные,
явно сломанную вёрстку, лендинг на /login там где не ожидалось, или что-то очевидно не соответствующее ожиданию.
ok=true если страница выглядит рабочей и соответствует ожиданию, даже если дизайн не идеален.`

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${screenshotBase64}` } },
          ],
        },
      ],
      max_tokens: 300,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`OpenRouter вернул ${response.status}: ${body.slice(0, 300)}`)
  }

  const data = await response.json()
  const text: string = data?.choices?.[0]?.message?.content ?? ''
  const cleaned = text.replace(/```json|```/g, '').trim()

  try {
    const parsed = JSON.parse(cleaned)
    return { ok: Boolean(parsed.ok), reason: String(parsed.reason ?? ''), raw: text }
  } catch {
    // Модель не вернула валидный JSON — считаем это провалом проверки,
    // но не роняем тест молча: причина будет видна в отчёте.
    return { ok: false, reason: `Не удалось распарсить ответ модели: ${text.slice(0, 200)}`, raw: text }
  }
}
