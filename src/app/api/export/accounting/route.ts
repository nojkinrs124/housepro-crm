import { createClient } from '@/lib/supabase/server'
import { requireOrgId } from '@/lib/org'

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

const TYPE_LABELS: Record<string, string> = { income: 'Доход', expense: 'Расход' }
const STATUS_LABELS: Record<string, string> = { planned: 'Запланирован', completed: 'Завершён', cancelled: 'Отменён' }

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // Явный фильтр по организации в дополнение к RLS: выгрузка денег — не то
  // место, где стоит полагаться на один слой защиты (проход 17.09.2026, AC-6).
  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return new Response('Организация не найдена', { status: 403 })

  const { data: transactions } = await supabase
    .from('accounting_transactions')
    .select(`
      type, amount, date, status, description, payment_method,
      category:accounting_categories(name)
    `)
    .eq('organization_id', orgId)
    .order('date', { ascending: false })

  const csvHeaders = ['Тип', 'Категория', 'Сумма', 'Дата', 'Статус', 'Способ оплаты', 'Описание']
  const rows = (transactions ?? []).map(t => [
    TYPE_LABELS[t.type] ?? t.type,
    t.category?.name ?? '',
    t.amount ?? '',
    t.date ? new Date(t.date).toLocaleDateString('ru-RU') : '',
    STATUS_LABELS[t.status] ?? t.status,
    t.payment_method ?? '',
    t.description ?? '',
  ])

  const csv = BOM + [csvHeaders, ...rows].map(r => r.map(csvEscape).join(';')).join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="accounting_transactions.csv"',
    },
  })
}
