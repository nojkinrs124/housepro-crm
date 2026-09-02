'use client'

import Link from 'next/link'
import { RegistryToolbar } from '@/components/layout/RegistryToolbar'
import { RegistryTable, type RegistryColumn } from '@/features/registry/components/RegistryTable'
import { BulkBar } from '@/features/registry/components/BulkBar'
import { useRegistryFilters } from '@/hooks/useRegistryFilters'
import { useSelection } from '@/hooks/useSelection'
import { formatDate } from '@/lib/utils'

export interface EmployeeRow {
  id: string
  fullName: string | null
  email: string | null
  phone: string | null
  role: string
  isActive: boolean
  deals: number
  contracts: number
  createdAt: string | null
}

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Администратор', manager: 'Менеджер',
  agent: 'Риелтор', accountant: 'Бухгалтер',
}

const ROLE_OPTIONS = [
  { value: 'all', label: 'Роль: все' },
  ...Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label })),
]
const ACTIVE_OPTIONS = [
  { value: 'all',   label: 'Доступ: любой' },
  { value: 'true',  label: 'Активные' },
  { value: 'false', label: 'Неактивные' },
]

export function EmployeesView({ employees }: { employees: EmployeeRow[] }) {
  const { search, setSearch, filtered, toolbarFilters, reset } = useRegistryFilters(employees, {
    storageKey: 'employees',
    haystack: e => [e.fullName, e.email, e.phone].filter(Boolean).join(' '),
    filters: [
      { key: 'role',   options: ROLE_OPTIONS,   field: e => e.role },
      { key: 'active', options: ACTIVE_OPTIONS, field: e => String(e.isActive) },
    ],
  })

  const selection = useSelection(filtered)

  const columns: RegistryColumn<EmployeeRow>[] = [
    {
      key: 'name', title: 'Сотрудник', cellClass: 'font-semibold max-w-[220px]',
      cell: e => (
        <Link href={`/employees/${e.id}`} className="block truncate hover:text-[var(--hp-accent)] transition-colors">
          {e.fullName ?? '—'}
        </Link>
      ),
    },
    {
      key: 'email', title: 'Email', cellClass: 'sub max-w-[220px]',
      cell: e => <span className="block truncate">{e.email ?? '—'}</span>,
    },
    {
      key: 'phone', title: 'Телефон', cellClass: 'sub whitespace-nowrap', headClass: 'hidden lg:table-cell',
      cell: e => e.phone ?? <span className="text-[var(--hp-tertiary)]">—</span>,
    },
    {
      key: 'role', title: 'Роль',
      cell: e => <span className="hp-badge hp-badge-neutral">{ROLE_LABELS[e.role] ?? e.role}</span>,
    },
    {
      key: 'access', title: 'Доступ',
      cell: e => (
        <span className={`hp-badge ${e.isActive ? 'hp-badge-good' : 'hp-badge-neutral'}`}>
          {e.isActive ? 'Активен' : 'Неактивен'}
        </span>
      ),
    },
    {
      key: 'deals', title: 'Сделок', cellClass: 'num', headClass: 'hidden md:table-cell',
      cell: e => e.deals,
    },
    {
      key: 'contracts', title: 'Договоров', cellClass: 'num', headClass: 'hidden md:table-cell',
      cell: e => e.contracts,
    },
    {
      key: 'since', title: 'В команде с', cellClass: 'sub whitespace-nowrap', headClass: 'hidden lg:table-cell',
      cell: e => formatDate(e.createdAt, { month: 'short', year: 'numeric' }),
    },
  ]

  return (
    <div className="space-y-4">
      <RegistryToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Поиск: имя, email, телефон"
        filters={toolbarFilters}
        onReset={reset}
        foundLabel={<>Найдено: <span className="font-semibold text-[var(--hp-ink)]">{filtered.length}</span> из {employees.length}</>}
      />

      <BulkBar registry="employees" selection={selection} />

      <RegistryTable
        rows={filtered}
        columns={columns}
        href={e => `/employees/${e.id}`}
        selection={selection}
        empty="Нет сотрудников по выбранным фильтрам"
      />
    </div>
  )
}
