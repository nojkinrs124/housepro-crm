'use client'

import Link from 'next/link'
import { ArrowDownCircle, ArrowUpCircle, Pencil } from 'lucide-react'
import { TRANSACTION_STATUSES } from '@/features/registry/config/registries'
import { RegistryToolbar } from '@/components/layout/RegistryToolbar'
import { RegistryTable, type RegistryColumn } from '@/features/registry/components/RegistryTable'
import { BulkBar } from '@/features/registry/components/BulkBar'
import { DeleteTransactionButton } from '@/features/accounting/components/DeleteTransactionButton'
import { useRegistryFilters } from '@/hooks/useRegistryFilters'
import { useSelection } from '@/hooks/useSelection'
import { formatAmount, formatDateCompact } from '@/lib/utils'

export interface TransactionRow {
  id: string
  type: string
  amount: number
  date: string
  description: string | null
  status: string
  categoryName: string | null
  categoryColor: string | null
  contractId: string | null
  contractNumber: string | null
  employeeName: string | null
}

const STATUS_BADGE: Record<string, string> = {
  completed: 'hp-badge-good',
  planned:   'hp-badge-warn',
  cancelled: 'hp-badge-neutral',
}
const STATUS_LABELS: Record<string, string> =
  Object.fromEntries(TRANSACTION_STATUSES.map(s => [s.value, s.label]))

const TYPE_OPTIONS = [
  { value: 'all',     label: 'Тип: все' },
  { value: 'income',  label: 'Доходы' },
  { value: 'expense', label: 'Расходы' },
]
const STATUS_OPTIONS = [
  { value: 'all', label: 'Статус: все' },
  ...TRANSACTION_STATUSES.map(s => ({ value: s.value, label: s.label })),
]

export function TransactionsView({ transactions }: { transactions: TransactionRow[] }) {
  const { search, setSearch, filtered, toolbarFilters, reset } = useRegistryFilters(transactions, {
    storageKey: 'transactions',
    haystack: t => [t.description, t.categoryName, t.contractNumber, t.employeeName].filter(Boolean).join(' '),
    filters: [
      { key: 'type',   options: TYPE_OPTIONS,   field: t => t.type },
      { key: 'status', options: STATUS_OPTIONS, field: t => t.status },
    ],
  })

  const selection = useSelection(filtered)

  const columns: RegistryColumn<TransactionRow>[] = [
    {
      key: 'date', title: 'Дата', cellClass: 'font-semibold whitespace-nowrap',
      cell: t => (
        <Link href={`/accounting/transactions/${t.id}`}
          className="inline-flex items-center gap-2 hover:text-[var(--hp-accent)] transition-colors">
          {t.type === 'income'
            ? <ArrowDownCircle className="w-4 h-4 shrink-0 text-[var(--hp-good)]" />
            : <ArrowUpCircle className="w-4 h-4 shrink-0 text-[var(--hp-danger)]" />}
          {formatDateCompact(t.date)}
        </Link>
      ),
    },
    {
      key: 'description', title: 'Назначение', cellClass: 'sub max-w-[240px]',
      cell: t => <span className="block truncate">{t.description ?? <span className="text-[var(--hp-tertiary)]">—</span>}</span>,
    },
    {
      key: 'amount', title: 'Сумма', cellClass: 'num font-semibold whitespace-nowrap',
      cell: t => (
        <span className={t.type === 'income' ? 'text-[var(--hp-good)]' : 'text-[var(--hp-danger)]'}>
          {t.type === 'income' ? '+' : '−'}{formatAmount(t.amount)} ₽
        </span>
      ),
    },
    {
      key: 'category', title: 'Категория', cellClass: 'sub whitespace-nowrap', headClass: 'hidden md:table-cell',
      cell: t => t.categoryName
        ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: t.categoryColor ?? 'var(--hp-tertiary)' }} />
            {t.categoryName}
          </span>
        )
        : <span className="text-[var(--hp-tertiary)]">—</span>,
    },
    {
      key: 'link', title: 'Договор / Сотрудник', cellClass: 'sub max-w-[200px]', headClass: 'hidden lg:table-cell',
      cell: t => {
        if (t.contractNumber) {
          return (
            <Link href={`/contracts/${t.contractId}`} className="block truncate hover:text-[var(--hp-accent)] transition-colors">
              №{t.contractNumber}
            </Link>
          )
        }
        if (t.employeeName) return <span className="block truncate">{t.employeeName}</span>
        return <span className="text-[var(--hp-tertiary)]">—</span>
      },
    },
    {
      key: 'status', title: 'Статус',
      cell: t => (
        <span className={`hp-badge ${STATUS_BADGE[t.status] ?? 'hp-badge-neutral'}`}>
          {STATUS_LABELS[t.status] ?? t.status}
        </span>
      ),
    },
    {
      key: 'actions', title: '', cellClass: 'whitespace-nowrap',
      cell: t => (
        <div className="flex items-center gap-1 justify-end">
          <Link href={`/accounting/transactions/${t.id}/edit`}
            className="p-1.5 text-[var(--hp-tertiary)] hover:text-[var(--hp-ink)] transition-colors"
            title="Редактировать">
            <Pencil style={{ width: 14, height: 14 }} />
          </Link>
          <DeleteTransactionButton id={t.id} />
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <RegistryToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Поиск: назначение, категория, договор"
        filters={toolbarFilters}
        onReset={reset}
        foundLabel={<>Найдено: <span className="font-semibold text-[var(--hp-ink)]">{filtered.length}</span> из {transactions.length}</>}
      />

      <BulkBar registry="transactions" selection={selection} />

      <RegistryTable
        rows={filtered}
        columns={columns}
        href={t => `/accounting/transactions/${t.id}`}
        selection={selection}
        empty="Нет операций по выбранным фильтрам"
      />
    </div>
  )
}
