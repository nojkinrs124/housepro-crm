'use client'

import { useState } from 'react'
import { MoreVertical, Loader2, LogOut, LogIn, Edit2 } from 'lucide-react'
import { deactivateEmployeeAction, activateEmployeeAction } from '@/features/users/actions/users.actions'

export function EmployeeActionsMenu({
  employeeId,
  isActive,
  onEdit,
}: {
  employeeId: string
  isActive: boolean
  onEdit: () => void
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleDeactivate = async () => {
    setLoading(true)
    try {
      const result = await deactivateEmployeeAction(employeeId)
      if (result.success) {
        setOpen(false)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleActivate = async () => {
    setLoading(true)
    try {
      const result = await activateEmployeeAction(employeeId)
      if (result.success) {
        setOpen(false)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={loading}
        className="p-2 hover:bg-muted rounded-lg transition disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreVertical className="w-4 h-4" />}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg z-50 min-w-40">
          <button
            onClick={() => {
              onEdit()
              setOpen(false)
            }}
            className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition flex items-center gap-2 first:rounded-t-lg"
          >
            <Edit2 className="w-4 h-4" />
            Редактировать
          </button>

          {isActive ? (
            <button
              onClick={handleDeactivate}
              disabled={loading}
              className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition flex items-center gap-2 last:rounded-b-lg disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" />
              Деактивировать
            </button>
          ) : (
            <button
              onClick={handleActivate}
              disabled={loading}
              className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition flex items-center gap-2 last:rounded-b-lg disabled:opacity-50"
            >
              <LogIn className="w-4 h-4" />
              Активировать
            </button>
          )}
        </div>
      )}
    </div>
  )
}
