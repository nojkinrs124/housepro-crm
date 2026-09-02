'use client'

import Link from 'next/link'
import { RegistryToolbar } from '@/components/layout/RegistryToolbar'
import { RegistryTable, type RegistryColumn } from '@/features/registry/components/RegistryTable'
import { useRegistryFilters } from '@/hooks/useRegistryFilters'
import { formatAmount, formatDateCompact } from '@/lib/utils'

/** Строка реестра управления: объект + всё, что вокруг него собрано. */
export interface ManagementRow {
  id: string
  title: string
  address: string | null
  ownerId: string | null
  ownerName: string | null
  managerName: string | null
  contractId: string | null
  contractNumber: string | null
  contractEnd: string | null
  /** Вознаграждение за управление, ₽/мес */
  fee: number | null
  /** Действующий договор аренды: кому объект сдан прямо сейчас */
  tenantId: string | null
  tenantName: string | null
  rentContractId: string | null
  rentAmount: number | null
  rentEnd: string | null
  /** Просроченные начисления именно по договору аренды */
  tenantDebt: number
  /** Ближайший плановый платёж по объекту */
  nextPaymentDate: string | null
  nextPaymentAmount: number | null
  /** Сумма просроченных начислений */
  overdueAmount: number
  incomeMonth: number
  expenseMonth: number
  openTasks: number
  metersCount: number
  lastReadingDate: string | null
  /** Состояние управления: по договору или без него */
  state: 'active' | 'expiring' | 'expired' | 'no_contract'
}

const STATE: Record<ManagementRow['state'], { label: string; badge: string }> = {
  active:      { label: 'Действует',    badge: 'hp-badge-good' },
  expiring:    { label: 'Истекает',     badge: 'hp-badge-warn' },
  expired:     { label: 'Истёк',        badge: 'hp-badge-danger' },
  no_contract: { label: 'Без договора', badge: 'hp-badge-neutral' },
}

const STATE_OPTIONS = [
  { value: 'all', label: 'Договор: любой' },
  ...Object.entries(STATE).map(([value, s]) => ({ value, label: s.label })),
]

export function ManagementView({ rows }: { rows: ManagementRow[] }) {
  const { search, setSearch, filtered, toolbarFilters, reset } = useRegistryFilters(rows, {
    storageKey: 'management',
    haystack: r => [r.title, r.address, r.ownerName, r.contractNumber].filter(Boolean).join(' '),
    filters: [{ key: 'state', options: STATE_OPTIONS, field: r => r.state }],
  })

  const columns: RegistryColumn<ManagementRow>[] = [
    {
      key: 'object', title: 'Объект', cellClass: 'font-semibold max-w-[240px]',
      cell: r => (
        <Link href={`/management/${r.id}`} className="block truncate hover:text-[var(--hp-accent)] transition-colors">
          {r.title}
          {r.address && <span className="block text-[11.5px] font-normal text-[var(--hp-sub)] truncate">{r.address}</span>}
        </Link>
      ),
    },
    {
      key: 'owner', title: 'Собственник', cellClass: 'max-w-[180px]',
      cell: r => r.ownerName
        ? <Link href={`/contacts/${r.ownerId}`} className="block truncate hover:text-[var(--hp-accent)] transition-colors">{r.ownerName}</Link>
        : <span className="text-[var(--hp-tertiary)]">—</span>,
    },
    {
      key: 'contract', title: 'Договор', cellClass: 'sub whitespace-nowrap', headClass: 'hidden lg:table-cell',
      cell: r => r.contractId
        ? (
          <Link href={`/contracts/${r.contractId}`} className="hover:text-[var(--hp-accent)] transition-colors">
            {r.contractNumber ?? 'Договор'}
            {r.contractEnd && <span className="text-[var(--hp-tertiary)]"> · до {formatDateCompact(r.contractEnd)}</span>}
          </Link>
        )
        : <span className="text-[var(--hp-tertiary)]">нет</span>,
    },
    {
      key: 'tenant', title: 'Арендатор', cellClass: 'max-w-[180px]',
      cell: r => {
        if (!r.tenantId) return <span className="text-[var(--hp-tertiary)]">свободен</span>
        return (
          <Link href={`/contacts/${r.tenantId}`} className="block truncate hover:text-[var(--hp-accent)] transition-colors">
            {r.tenantName}
            {r.rentAmount != null && (
              <span className="block text-[11.5px] text-[var(--hp-sub)]">
                {formatAmount(r.rentAmount)} ₽/мес
                {r.tenantDebt > 0 && <span className="text-[var(--hp-danger)]"> · долг {formatAmount(r.tenantDebt)} ₽</span>}
              </span>
            )}
          </Link>
        )
      },
    },
    {
      key: 'state', title: 'Статус',
      cell: r => <span className={`hp-badge ${STATE[r.state].badge}`}>{STATE[r.state].label}</span>,
    },
    {
      key: 'fee', title: 'Вознагр.', cellClass: 'num whitespace-nowrap', headClass: 'hidden md:table-cell',
      cell: r => r.fee
        ? <>{formatAmount(r.fee)} <span className="text-[var(--hp-tertiary)] font-normal">₽</span></>
        : <span className="text-[var(--hp-tertiary)]">—</span>,
    },
    {
      key: 'next', title: 'Платёж', cellClass: 'sub whitespace-nowrap',
      cell: r => {
        if (r.overdueAmount > 0) {
          return <span className="text-[var(--hp-danger)] font-semibold">просрочено {formatAmount(r.overdueAmount)} ₽</span>
        }
        if (!r.nextPaymentDate) return <span className="text-[var(--hp-tertiary)]">не запланирован</span>
        return <>{formatDateCompact(r.nextPaymentDate)}{r.nextPaymentAmount ? ` · ${formatAmount(r.nextPaymentAmount)} ₽` : ''}</>
      },
    },
    {
      key: 'month', title: 'За месяц', cellClass: 'num whitespace-nowrap', headClass: 'hidden lg:table-cell',
      cell: r => (
        <span className={r.incomeMonth - r.expenseMonth < 0 ? 'text-[var(--hp-danger)]' : ''}>
          {formatAmount(r.incomeMonth - r.expenseMonth)} <span className="text-[var(--hp-tertiary)] font-normal">₽</span>
        </span>
      ),
    },
    {
      key: 'tasks', title: 'Задачи', cellClass: 'num', headClass: 'hidden md:table-cell',
      cell: r => r.openTasks > 0 ? r.openTasks : <span className="text-[var(--hp-tertiary)]">—</span>,
    },
    {
      key: 'meters', title: 'Счётчики', cellClass: 'sub whitespace-nowrap', headClass: 'hidden lg:table-cell',
      cell: r => r.metersCount === 0
        ? <span className="text-[var(--hp-tertiary)]">нет</span>
        : <>{r.metersCount} · {r.lastReadingDate ? formatDateCompact(r.lastReadingDate) : <span className="text-[var(--hp-warn)]">без показаний</span>}</>,
    },
  ]

  return (
    <div className="space-y-4">
      <RegistryToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Поиск: объект, адрес, собственник, договор"
        filters={toolbarFilters}
        onReset={reset}
        foundLabel={<>Найдено: <span className="font-semibold text-[var(--hp-ink)]">{filtered.length}</span> из {rows.length}</>}
      />

      <RegistryTable
        rows={filtered}
        columns={columns}
        href={r => `/management/${r.id}`}
        empty="Нет объектов в управлении по выбранным фильтрам"
      />
    </div>
  )
}
