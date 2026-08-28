'use client'

import { useState, useTransition } from 'react'
import { updateCategoryAction } from '../actions/categories.actions'
import { DeleteCategoryButton } from './DeleteCategoryButton'
import { Lock, Pencil, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import type { AccountingCategory } from '@/types/database'

const COLORS = [
  '#16A34A', '#22C55E', '#4ADE80', '#EF4444', '#F97316',
  '#8B5CF6', '#06B6D4', '#F59E0B', '#DB2777', '#64748B',
]

export function CategoryRow({ category }: { category: AccountingCategory }) {
  const [isEditing, setIsEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState(category.name)
  const [color, setColor] = useState(category.color)

  function handleSave() {
    const formData = new FormData()
    formData.set('name', name)
    formData.set('color', color)
    formData.set('icon', category.icon)
    startTransition(async () => {
      const res = await updateCategoryAction(category.id, formData)
      if (res && 'error' in res) {
        toast.error(res.error)
        return
      }
      toast.success('Категория обновлена')
      setIsEditing(false)
    })
  }

  function handleCancel() {
    setName(category.name)
    setColor(category.color)
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 px-5 py-2.5">
        <select
          value={color}
          onChange={e => setColor(e.target.value)}
          disabled={isPending}
          className="h-8 px-2 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer shrink-0"
        >
          {COLORS.map(c => (
            <option key={c} value={c} style={{ background: c, color: '#fff' }}>{c}</option>
          ))}
        </select>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          disabled={isPending}
          className="flex-1 min-w-0 h-8 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
        />
        <button
          onClick={handleSave}
          disabled={isPending || !name.trim()}
          className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors disabled:opacity-40 shrink-0"
          title="Сохранить"
        >
          <Check style={{ width: 14, height: 14 }} />
        </button>
        <button
          onClick={handleCancel}
          disabled={isPending}
          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors disabled:opacity-40 shrink-0"
          title="Отмена"
        >
          <X style={{ width: 14, height: 14 }} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: category.color }} />
      <span className="flex-1 text-sm font-medium text-foreground min-w-0 truncate">
        {category.name}
      </span>
      {category.is_system ? (
        <Lock style={{ width: 13, height: 13 }} className="text-slate-300 shrink-0" />
      ) : (
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => setIsEditing(true)}
            className="p-1.5 rounded-lg text-slate-300 hover:text-foreground hover:bg-slate-100 transition-colors"
            title="Редактировать"
          >
            <Pencil style={{ width: 13, height: 13 }} />
          </button>
          <DeleteCategoryButton id={category.id} />
        </div>
      )}
    </div>
  )
}
