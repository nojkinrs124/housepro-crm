'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { BookOpen, Loader2 } from 'lucide-react'
import { loadStandardHandbookAction } from '@/features/knowledge/actions/knowledge.actions'

/** Кнопка пустого экрана базы знаний: залить стандартный справочник одним кликом. */
export function LoadHandbookButton() {
  const [pending, start] = useTransition()
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        disabled={pending}
        className="hp-btn-primary"
        data-testid="knowledge-load-handbook"
        onClick={() => start(async () => {
          const res = await loadStandardHandbookAction()
          if (res && 'error' in res && res.error) toast.error(res.error)
          else if (res && 'message' in res && res.message) toast.success(res.message)
        })}
      >
        {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
        Загрузить стандартный справочник
      </button>
      <Link href="/knowledge/new" className="hp-btn-secondary">Новая статья</Link>
    </div>
  )
}
