import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'

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

const ROLE_LABELS: Record<string, string> = {
  client: 'Клиент', owner: 'Собственник', both: 'Клиент и собственник',
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: contacts } = await supabase
    .from('contacts')
    .select('full_name, company_name, phone, email, inn, kpp, ogrn, role, created_at')
    .order('created_at', { ascending: false })

  const csvHeaders = ['ФИО/Название', 'Телефон', 'Email', 'ИНН', 'КПП', 'ОГРН', 'Роль', 'Дата создания']
  const rows = (contacts ?? []).map(c => [
    c.company_name || c.full_name,
    c.phone ?? '',
    c.email ?? '',
    c.inn ?? '',
    c.kpp ?? '',
    c.ogrn ?? '',
    ROLE_LABELS[c.role] ?? c.role,
    formatDate(c.created_at),
  ])

  const csv = BOM + [csvHeaders, ...rows].map(r => r.map(csvEscape).join(';')).join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="contacts.csv"',
    },
  })
}
