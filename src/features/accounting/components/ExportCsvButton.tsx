'use client'

import { Download } from 'lucide-react'
import type { AccountingTransaction } from '@/types/database'

interface Props {
 transactions: AccountingTransaction[]
}

const TYPE_LABEL: Record<string, string> = { income: 'Доход', expense: 'Расход' }
const STATUS_LABEL: Record<string, string> = { completed: 'Выполнено', planned: 'Запланировано', cancelled: 'Отменено' }
const METHOD_LABEL: Record<string, string> = { cash: 'Наличные', bank: 'Банк', card: 'Карта', other: 'Другое' }

function escapeCSV(v: unknown): string {
 const s = String(v ?? '')
 if (s.includes(',') || s.includes('"') || s.includes('\n')) {
 return '"' + s.replace(/"/g, '""') + '"'
 }
 return s
}

export function ExportCsvButton({ transactions }: Props) {
 function handleExport() {
 const headers = ['Тип', 'Дата', 'Сумма', 'Категория', 'Статус', 'Способ оплаты', 'Договор', 'Сотрудник', 'Описание']

 const rows = transactions.map(t => [
 TYPE_LABEL[t.type] ?? t.type,
 t.date,
 Number(t.amount).toFixed(2),
 t.category?.name ?? '',
 STATUS_LABEL[t.status] ?? t.status,
 t.payment_method ? (METHOD_LABEL[t.payment_method] ?? t.payment_method) : '',
 t.contract?.contract_number ?? '',
 t.employee?.full_name ?? '',
 t.description ?? '',
 ])

 const csv = [
 headers.map(escapeCSV).join(','),
 ...rows.map(r => r.map(escapeCSV).join(',')),
 ].join('\r\n')

 const bom = '\uFEFF' // UTF-8 BOM for Excel
 const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
 const url = URL.createObjectURL(blob)
 const a = document.createElement('a')
 a.href = url
 a.download = `accounting_${new Date().toISOString().slice(0, 10)}.csv`
 a.click()
 URL.revokeObjectURL(url)
 }

 return (
 <button
 onClick={handleExport}
 className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-sm font-semibold text-[#374151] hover:bg-slate-50 transition-all"
 >
 <Download className="w-4 h-4" />
 CSV
 </button>
 )
}
