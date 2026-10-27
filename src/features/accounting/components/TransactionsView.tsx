'use client'

import Link from 'next/link'
import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { TRANSACTION_STATUSES } from '@/features/registry/config/registries'
import { RegistryToolbar } from '@/components/layout/RegistryToolbar'
import { EmptyState } from '@/components/layout/EmptyState'
import { RegistryTable, type RegistryColumn } from '@/features/registry/components/RegistryTable'
import { BulkBar } from '@/features/registry/components/BulkBar'
import { TransactionRowMenu } from '@/features/accounting/components/DeleteTransactionButton'
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
  /** true — реальный доход агентства, false — транзит клиента (аренда/депозит), null — расход. */
  isRealIncome: boolean | null
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
// Реальный доход агентства vs транзит клиента — та же находка, что дала
// повод завести этот фильтр: владелец увидел «Приход 133 000 ₽» за октябрь
// и не смог понять по таблице, что агентство из них не заработало ничего —
// все деньги были арендой жильцов и депозитом, просто прошедшими через кассу.
const EARNED_OPTIONS = [
  { value: 'all',  label: 'Доход: всё' },
  { value: 'real', label: 'Только реальный доход' },
  { value: 'transit', label: 'Только транзит клиентов' },
]

export function TransactionsView({ transactions }: { transactions: TransactionRow[] }) {
  const { search, setSearch, filtered, toolbarFilters, reset } = useRegistryFilters(transactions, {
    storageKey: 'transactions',
    haystack: t => [t.description, t.categoryName, t.contractNumber, t.employeeName].filter(Boolean).join(' '),
    filters: [
      { key: 'type',   options: TYPE_OPTIONS,   field: t => t.type },
      { key: 'status', options: STATUS_OPTIONS, field: t => t.status },
      { key: 'earned', options: EARNED_OPTIONS, field: t => t.isRealIncome === null ? 'na' : (t.isRealIncome ? 'real' : 'transit') },
    ],
  })

  const selection = useSelection(filtered)

  // Сумма реального дохода и транзита в текущей выборке — тот же вопрос,
  // который владелец задавал по скрину («сколько из этого реально заработано»),
  // но без необходимости считать в уме строку за строкой.
  const realIncomeSum = filtered.filter(t => t.isRealIncome === true).reduce((s, t) => s + t.amount, 0)
  const transitSum    = filtered.filter(t => t.isRealIncome === false).reduce((s, t) => s + t.amount, 0)

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
      key: 'category', title: 'Категория', cellClass: 'sub whitespace-nowrap', hideBelow: 'lg',
      cell: t => (
        <span className="inline-flex items-center gap-1.5">
          {t.categoryName
            ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: t.categoryColor ?? 'var(--hp-tertiary)' }} />
                {t.categoryName}
              </span>
            )
            : <span className="text-[var(--hp-tertiary)]">—</span>}
          {/* Доход/транзит — на уровне строки, не только в сводке сверху: находка
              владельца 27.10.2026, таблица скрывала, что аренда клиента и депозит
              не являются заработком агентства, хотя лежат в той же колонке «Сумма». */}
          {t.isRealIncome === true && <span className="hp-badge hp-badge-good text-[10px]">доход</span>}
          {t.isRealIncome === false && <span className="hp-badge hp-badge-neutral text-[10px]">транзит</span>}
        </span>
      ),
    },
    {
      key: 'link', title: 'Договор / Сотрудник', cellClass: 'sub max-w-[200px]', hideBelow: 'xl',
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
      cell: t => <div className="flex justify-end"><TransactionRowMenu id={t.id} /></div>,
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

      {/* Итог по текущему фильтру: сколько из попавших в выборку строк — реальный
          доход агентства, а сколько — транзит клиента. Отвечает на вопрос
          «сколько агентство реально заработало за этот месяц», не заставляя
          считать строки вручную (повод: скрин владельца с таблицей за октябрь,
          где всё «Арендный платёж + Депозит» выглядело как доход). */}
      {(realIncomeSum > 0 || transitSum > 0) && (
        <div className="hp-block">
          <div className="hp-block-grid">
            <div className="hp-block-row"><span className="label">Реальный доход (в выборке)</span><span className="value">+{formatAmount(realIncomeSum)} ₽</span></div>
            <div className="hp-block-row"><span className="label">Транзит клиентов (в выборке)</span><span className="value">{formatAmount(transitSum)} ₽</span></div>
          </div>
        </div>
      )}

      <BulkBar registry="transactions" selection={selection} />

      {filtered.length === 0 ? (
        <EmptyState
          title="Ничего не найдено"
          description="По этим фильтрам операций нет — попробуйте их сбросить."
          action={<button type="button" onClick={reset} className="hp-btn-secondary">Сбросить фильтры</button>}
        />
      ) : (
        <RegistryTable
          rows={filtered}
          columns={columns}
          href={t => `/accounting/transactions/${t.id}`}
          selection={selection}
          empty="Ничего не найдено"
        />
      )}
    </div>
  )
}
