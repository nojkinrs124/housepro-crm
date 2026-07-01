import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { DeleteTransactionButton } from '@/features/accounting/components/DeleteTransactionButton'
import { ArrowLeft, ArrowDownCircle, ArrowUpCircle, Pencil } from 'lucide-react'
import Link from 'next/link'

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  completed: { label: 'Выполнено',    cls: 'bg-green-50 text-green-700 border border-green-200' },
  planned:   { label: 'Запланировано', cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  cancelled: { label: 'Отменено',     cls: 'bg-slate-50 text-slate-500 border border-slate-200' },
}
const METHOD_LABEL: Record<string, string> = {
  cash: 'Наличные', bank: 'Безналичный', card: 'Карта', other: 'Другое',
}

function fmt(n: number) { return n.toLocaleString('ru-RU') + ' ₽' }
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: raw, error: rawError } = await supabase
    .from('accounting_transactions')
    .select(`
      id, type, amount, date, description, status, payment_method, due_date,
      created_at, legacy_payment_id,
      category:accounting_categories(id, name, color),
      contract:contracts(id, contract_number, contract_type),
      deal:deals(id, deal_type),
      contact:contacts(id, full_name),
      employee:users(id, full_name)
    `)
    .eq('id', id)
    .single()

  if (rawError && rawError.code !== 'PGRST116') {
    throw new Error(`Не удалось загрузить операцию: ${rawError.message}`)
  }
  if (!raw) notFound()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = raw as any

  const isIncome = t.type === 'income'
  const sc = STATUS_CFG[t.status] ?? STATUS_CFG.completed

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/accounting"
          className="inline-flex items-center gap-2 text-sm font-medium text-[#64748B] hover:text-[#111827] transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Бухгалтерия
        </Link>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${isIncome ? 'bg-green-50' : 'bg-red-50'}`}>
              {isIncome
                ? <ArrowDownCircle className="w-6 h-6 text-green-600" />
                : <ArrowUpCircle   className="w-6 h-6 text-red-500" />
              }
            </div>
            <div>
              <h1 className="text-[28px] font-bold text-[#111827] tracking-tight leading-tight">
                {isIncome ? '+' : '−'}{fmt(Number(t.amount))}
              </h1>
              <p className="text-[#64748B] text-sm font-medium mt-0.5">
                {isIncome ? 'Доход' : 'Расход'} · {fmtDate(t.date)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <Link
              href={`/accounting/transactions/${id}/edit`}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-[14px] text-sm font-semibold text-[#374151] hover:bg-slate-50 transition-all"
            >
              <Pencil className="w-4 h-4" />
              Редактировать
            </Link>
            <DeleteTransactionButton id={id} redirectAfter="/accounting" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main info */}
        <div
          className="lg:col-span-2 bg-white rounded-[20px] border border-slate-100 p-5"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}
        >
          <h2 className="font-bold text-[#111827] text-[15px] mb-4">Информация</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            {[
              { label: 'Тип', value: isIncome ? 'Доход' : 'Расход' },
              { label: 'Сумма', value: fmt(Number(t.amount)) },
              { label: 'Дата', value: fmtDate(t.date) },
              t.due_date ? { label: 'Срок', value: fmtDate(t.due_date) } : null,
              t.payment_method ? { label: 'Способ оплаты', value: METHOD_LABEL[t.payment_method] ?? t.payment_method } : null,
              t.description ? { label: 'Описание', value: t.description } : null,
            ].filter(Boolean).map((item) => (
              <div key={item!.label}>
                <dt className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-1">{item!.label}</dt>
                <dd className="text-sm font-medium text-[#111827]">{item!.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Side info */}
        <div className="space-y-4">
          <div
            className="bg-white rounded-[20px] border border-slate-100 p-5"
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}
          >
            <h2 className="font-bold text-[#111827] text-[15px] mb-3">Статус</h2>
            <span className={`text-sm font-semibold px-3 py-1.5 rounded-full ${sc.cls}`}>{sc.label}</span>
          </div>

          {t.category && (
            <div
              className="bg-white rounded-[20px] border border-slate-100 p-5"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}
            >
              <h2 className="font-bold text-[#111827] text-[15px] mb-3">Категория</h2>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: t.category.color }} />
                <span className="text-sm font-medium text-[#111827]">{t.category.name}</span>
              </div>
            </div>
          )}

          {(t.contract || t.deal || t.employee || t.contact) && (
            <div
              className="bg-white rounded-[20px] border border-slate-100 p-5"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}
            >
              <h2 className="font-bold text-[#111827] text-[15px] mb-3">Привязки</h2>
              <div className="space-y-2">
                {t.contract && (
                  <div>
                    <p className="text-xs text-[#64748B] font-medium mb-0.5">Договор</p>
                    <Link href={`/contracts/${t.contract.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                      №{t.contract.contract_number ?? t.contract.id.slice(0, 8)}
                    </Link>
                  </div>
                )}
                {t.deal && (
                  <div>
                    <p className="text-xs text-[#64748B] font-medium mb-0.5">Сделка</p>
                    <Link href={`/deals/${t.deal.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                      {t.deal.deal_type} · {t.deal.id.slice(0, 8)}
                    </Link>
                  </div>
                )}
                {t.employee && (
                  <div>
                    <p className="text-xs text-[#64748B] font-medium mb-0.5">Сотрудник</p>
                    <Link href={`/employees/${t.employee.id}`} className="text-sm font-medium text-[#111827] hover:text-blue-600">
                      {t.employee.full_name}
                    </Link>
                  </div>
                )}
                {t.contact && (
                  <div>
                    <p className="text-xs text-[#64748B] font-medium mb-0.5">Контакт</p>
                    <Link href={`/contacts/${t.contact.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                      {t.contact.full_name}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
