// Один вызов OpenRouter на все модули бота (диалог, извлечение из документов).
// Формат — OpenAI chat completions с function calling: OpenRouter отдаёт его
// независимо от того, какая модель под капотом.

export type LlmContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'file'; file: { filename: string; file_data: string } }

export type LlmContent = string | LlmContentPart[]

export interface LlmToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: LlmContent | null
  tool_calls?: LlmToolCall[]
  tool_call_id?: string
}

export interface LlmCompletion {
  choices?: Array<{ message?: LlmMessage }>
}

export function llmModel(): string {
  return process.env.OPENROUTER_MODEL ?? 'anthropic/claude-sonnet-5'
}

export async function chatCompletion(opts: {
  system: string
  messages: LlmMessage[]
  tools?: readonly unknown[]
  /** 'auto' | 'none' | имя функции, которую модель обязана вызвать. */
  toolChoice?: 'auto' | 'none' | { name: string }
  parallelToolCalls?: boolean
  maxTokens?: number
}): Promise<LlmCompletion> {
  const body: Record<string, unknown> = {
    model: llmModel(),
    messages: [{ role: 'system', content: opts.system }, ...opts.messages],
  }
  if (opts.tools?.length) {
    body.tools = opts.tools
    body.tool_choice =
      opts.toolChoice && typeof opts.toolChoice === 'object'
        ? { type: 'function', function: { name: opts.toolChoice.name } }
        : (opts.toolChoice ?? 'auto')
    body.parallel_tool_calls = opts.parallelToolCalls ?? false
  }
  if (opts.maxTokens) body.max_tokens = opts.maxTokens

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`OpenRouter error ${res.status}: ${await res.text()}`)
  }
  return res.json()
}
