'use client'

import { useTransition } from 'react'
import { Star, Trash2, Loader2 } from 'lucide-react'
import { setDefaultCompanyProfileAction, deleteCompanyProfileAction } from '@/features/settings/actions/company.actions'
import { useRouter } from 'next/navigation'

export function CompanyProfileCardActions({ id, isDefault }: { id: string; isDefault: boolean }) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleSetDefault() {
    startTransition(async () => {
      await setDefaultCompanyProfileAction(id)
      router.refresh()
    })
  }

  function handleDelete() {
    if (!confirm('Удалить профиль компании? Это действие нельзя отменить.')) return
    startTransition(async () => {
      const result = await deleteCompanyProfileAction(id)
      if (result?.error) {
        alert(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      {!isDefault && (
        <button type="button" onClick={handleSetDefault} disabled={pending}
          title="Сделать профилем по умолчанию"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-accent transition-all disabled:opacity-60">
          {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Star className="w-3.5 h-3.5" />}
          По умолчанию
        </button>
      )}
      <button type="button" onClick={handleDelete} disabled={pending} title="Удалить профиль"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50 transition-all disabled:opacity-60">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
