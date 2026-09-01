// Справочник статусов контрагента и производные от него хелперы.
//
// Вынесено из counterparty.actions.ts: файл с 'use server' может экспортировать
// только async-функции, а константы и синхронные хелперы оттуда роняют сборку.
// Заодно этот модуль свободно импортируется клиентскими компонентами.

export interface CounterpartySnapshot {
  name: string
  inn: string | null
  kpp: string | null
  ogrn: string | null
  legalAddress: string | null
  managerName: string | null
  managerPost: string | null
  /** ACTIVE / LIQUIDATING / LIQUIDATED / BANKRUPT / REORGANIZING */
  status: string | null
  type: string | null
  checkedAt: string
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'действующая',
  LIQUIDATING: 'в процессе ликвидации',
  LIQUIDATED: 'ликвидирована',
  BANKRUPT: 'банкротство',
  REORGANIZING: 'реорганизация',
}

export function describeCounterpartyStatus(status: string | null | undefined): string {
  if (!status) return 'статус неизвестен'
  return STATUS_LABELS[status] ?? status
}
