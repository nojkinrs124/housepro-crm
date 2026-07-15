// Распознавание голосовых сообщений через OpenRouter /api/v1/audio/transcriptions.
// Отдельный от chat/completions эндпоинт — модель Whisper, не связана с OPENROUTER_MODEL,
// который используется для основного диалога (это разные задачи: STT и tool-calling).

export async function transcribeAudio(base64Audio: string, format: 'ogg' = 'ogg'): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'openai/whisper-large-v3',
      input_audio: { data: base64Audio, format },
      language: 'ru',
    }),
  })

  if (!res.ok) {
    throw new Error(`Transcription error ${res.status}: ${await res.text()}`)
  }

  const json = await res.json()
  const text = json.text ?? json.data?.text
  if (!text) throw new Error('Пустой результат распознавания')
  return text
}
