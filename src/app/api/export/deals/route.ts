import { createClient } from '@/lib/supabase/server'

const BOM = '\uFEFF'

function csvEscape(value: unknown): string {
  const s = String(value ?? '')
  if (s.includes(';') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

const DEAL_TYPE_LABELS: Record<string, string> = {
  rent: 'Аренда', sale: 'Продажа', management: 'Управление', commercial: 'Коммерция', subrent: 'Субаренда',
}
const STATUS_LABELS: Record<string, string> = {
  new: 'Новая', showing: 'Показ', negotiation: 'Переговоры', contract: 'Договор',
  payment: 'Оплата', completed: 'Завершена', cancelled: 'Отменена',
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (deals ?? []).map((d: any) => [
    DEAL_TYPE_LABELS[d.deal_type] ?? d.deal_type,
    STATUS_LABELS[d.status] ?? d.status,
    d.property?.title ?? '',
    d.owner?.full_name ?? '',
    d.client?.full_name ?? '',
    d.amount ?? '',
    d.commission ?? '',
    new Date(d.created_at).toLocaleDateString('ru-RU'),
  ])

  const csv = BOM + [csvHeaders, ...rows].map(r => r.map(csvEscape).join(';')).join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="deals.csv"',
    },
  })
}
