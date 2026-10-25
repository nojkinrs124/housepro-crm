'use client'

import { useTransition } from 'react'
import { deleteTransactionAction } from '../actions/accounting.actions'
import { Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { confirmDialog } from '@/components/forms/ConfirmDialog'
import { RowMenu } from '@/features/registry/components/RowMenu'

interface Props {
  id: string
  redirectAfter?: string
}

function useDeleteTransaction(id: string, redirectAfter?: string) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  async function handleDelete() {
    if (!(await confirmDialog('Удалить операцию? Она пропадёт из отчёта и доходности объекта — отменить нельзя.'))) return
    startTransition(async () => {
      const res = await deleteTransactionAction(id)
      if (res && 'error' in res) {
        toast.error(res.error)
      } else {
        toast.success('Операция удалена')
        router.push(redirectAfter ?? '/accounting')
        router.refresh()
      }
    })
  }
  return { handleDelete, isPending }
}

export function DeleteTransactionButton({ id, redirectAfter }: Props) {
  const { handleDelete, isPending } = useDeleteTransaction(id, redirectAfter)
  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="p-1.5 text-[var(--hp-tertiary)] hover:text-[var(--hp-danger)] hover:bg-[var(--hp-danger-tint)] transition-colors disabled:opacity-50"
      title="Удалить"
    >
      <Trash2 style={{ width: 14, height: 14 }} />
    </button>
  )
}

/** Меню «…» строки реестра операций: изменить / удалить (с подтверждением). */
export function TransactionRowMenu({ id }: { id: string }) {
  const { handleDelete, isPending } = useDeleteTransaction(id)
  return (
    <RowMenu
      label="Действия с операцией"
      items={[
        { label: 'Изменить', href: `/accounting/transactions/${id}/edit`, icon: <Pencil style={{ width: 14, height: 14 }} /> },
        { label: 'Удалить', onSelect: handleDelete, danger: true, disabled: isPending, icon: <Trash2 style={{ width: 14, height: 14 }} /> },
      ]}
    />
  )
}
