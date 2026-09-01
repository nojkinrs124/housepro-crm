// Учётные данные интеграции с Подпислоном.
//
// Ключ лежит в channel_integrations (kind = 'signing') — там же, где ключи
// телефонии и эквайринга: у каждой организации свой, в env его класть нельзя,
// иначе все агентства в SaaS подписывали бы документы от одной компании.

import { getChannelIntegration } from '@/lib/communications/log'

export interface PodpislonSettings {
  apiKey: string
  /** Секрет в адресе вебхука — им сервис «представляется» нашей организации. */
  webhookSecret: string | null
  isActive: boolean
}

export function readPodpislonApiKey(credentials: Record<string, unknown> | null | undefined): string | null {
  const value = credentials?.apiKey
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

/** Настройки организации или null, если Подпислон не подключён. */
export async function getPodpislonSettings(orgId: string): Promise<PodpislonSettings | null> {
  const row = await getChannelIntegration(orgId, 'signing')
  if (!row || row.provider !== 'podpislon') return null

  const apiKey = readPodpislonApiKey(row.credentials as Record<string, unknown> | null)
  if (!apiKey) return null

  return {
    apiKey,
    webhookSecret: (row.webhook_secret as string | null) ?? null,
    isActive: Boolean(row.is_active),
  }
}
