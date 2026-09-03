import { createClient } from '@/lib/supabase/server'

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

const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик', generated: 'Сформирован', signed: 'Подписан',
  active: 'Действует', completed: 'Завершён', cancelled: 'Расторгнут',
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: contracts } = await supabase
    .from('contracts')
    .select(`
      contract_number, contract_type, status, amount, start_date, end_date, created_at,
      property:properties(title, address)
    `)
    .order('created_at', { ascending: false })

  const csvHeaders = ['Номер договора', 'Тип', 'Статус', 'Объект', 'Сумма', 'Дата начала', 'Дата окончания', 'Дата создания']
  const rows = (contracts ?? []).map(c => [
    c.contract_number ?? '',
    c.contract_type ?? '',
    STATUS_LABELS[c.status] ?? c.status,
    c.property?.title ?? '',
    c.amount ?? '',
    c.start_date ? new Date(c.start_date).toLocaleDateString('ru-RU') : '',
    c.end_date ? new Date(c.end_date).toLocaleDateString('ru-RU') : '',
    c.created_at ? new Date(c.created_at).toLocaleDateString('ru-RU') : '',
  ])

  const csv = BOM + [csvHeaders, ...rows].map(r => r.map(csvEscape).join(';')).join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="contracts.csv"',
    },
  })
}
