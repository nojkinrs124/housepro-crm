import { createClient } from '@/lib/supabase/server'
import { DEAL_TYPE_LABELS, DEAL_STATUS_LABELS as STATUS_LABELS } from '@/features/deals/config/deal-stages'

// КРИТИЧНО: этот роут отдаёт данные, специфичные для конкретной организации/пользователя
// (RLS или ручная фильтрация по organization_id). Next.js по умолчанию может закэшировать
// GET Route Handler и отдать один и тот же ответ разным пользователям/организациям по
// одному URL — это утечка данных между тенантами. force-dynamic отключает это кэширование.
export const dynamic = 'force-dynamic'

const BOM = '\uFEFF'

function csvEscape(value: unknown): string {
  const s = String(value ?? '')
  if (s.includes(';') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}


export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: deals } = await supabase
    .from('deals')
    .select(`
      deal_type, status, amount, commission, created_at,
      owner:contacts!deals_owner_contact_id_fkey(full_name),
      client:contacts!deals_client_contact_id_fkey(full_name),
      property:properties(title, address)
    `)
    .order('created_at', { ascending: false })

  const csvHeaders = ['Тип сделки', 'Статус', 'Объект', 'Собственник', 'Клиент', 'Сумма', 'Комиссия', 'Дата создания']
  const rows = (deals ?? []).map(d => [
    DEAL_TYPE_LABELS[d.deal_type] ?? d.deal_type,
    STATUS_LABELS[d.status] ?? d.status,
    d.property?.title ?? '',
    d.owner?.full_name ?? '',
    d.client?.full_name ?? '',
    d.amount ?? '',
    d.commission ?? '',
    d.created_at ? new Date(d.created_at).toLocaleDateString('ru-RU') : '',
  ])

  const csv = BOM + [csvHeaders, ...rows].map(r => r.map(csvEscape).join(';')).join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="deals.csv"',
    },
  })
}
