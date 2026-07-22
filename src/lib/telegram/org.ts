import { authenticateApiKey } from '@/lib/api-auth'

// Бот и крон-джобы работают от имени одной служебной организации, привязанной
// к HOUSEPRO_BOT_API_KEY (тот же паттерн, что уже используется в webhook route).
// Вынесено сюда, чтобы не дублировать в каждом новом cron route.
export async function resolveBotOrgId(): Promise<string | null> {
  const key = process.env.HOUSEPRO_BOT_API_KEY
  if (!key) return null
  const fakeReq = new Request('http://internal.local/', { headers: { Authorization: `Bearer ${key}` } })
  const auth = await authenticateApiKey(fakeReq)
  return auth.orgId ?? null
}
