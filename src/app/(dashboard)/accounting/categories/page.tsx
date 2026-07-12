import { createClient } from '@/lib/supabase/server'
import { AddCategoryForm } from '@/features/accounting/components/AddCategoryForm'
import { DeleteCategoryButton } from '@/features/accounting/components/DeleteCategoryButton'
import { Lock } from 'lucide-react'
import Link from 'next/link'
import type { AccountingCategory } from '@/types/database'
import { PageHeader } from '@/components/layout/PageHeader'

export default async function CategoriesPage() {
  const supabase = await createClient()
  const { data: raw } = await supabase
    .from('accounting_categories')
    .select('id, name, type, color, icon, is_system, sort_order, created_at')
    .order('type')
    .order('sort_order')
    .order('name')

  const categories = (raw ?? []) as AccountingCategory[]
  const income  = categories.filter(c => c.type === 'income')
  const expense = categories.filter(c => c.type === 'expense')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Категории"
        subtitle="Системные категории защищены от удаления"
        backHref="/accounting"
        backLabel="Бухгалтерия"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income */}
        <div
          className="bg-white rounded-[20px] border border-slate-100"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <h2 className="font-bold text-foreground text-[15px]">Доходы</h2>
              <span className="ml-1 text-xs text-muted-foreground font-medium">{income.length}</span>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {income.map(c => (
              <div key={c.id} className="flex items-center gap-3 px-5 py-3.5">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: c.color }}
                />
                <span className="flex-1 text-sm font-medium text-foreground min-w-0 truncate">
                  {c.name}
                </span>
                {c.is_system
                  ? <Lock style={{ width: 13, height: 13 }} className="text-slate-300 shrink-0" />
                  : <DeleteCategoryButton id={c.id} />
                }
              </div>
            ))}
          </div>
          <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/40 rounded-b-[20px]">
            <AddCategoryForm defaultType="income" />
          </div>
        </div>

        {/* Expense */}
        <div
          className="bg-white rounded-[20px] border border-slate-100"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <h2 className="font-bold text-foreground text-[15px]">Расходы</h2>
              <span className="ml-1 text-xs text-muted-foreground font-medium">{expense.length}</span>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {expense.map(c => (
              <div key={c.id} className="flex items-center gap-3 px-5 py-3.5">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: c.color }}
                />
                <span className="flex-1 text-sm font-medium text-foreground min-w-0 truncate">
                  {c.name}
                </span>
                {c.is_system
                  ? <Lock style={{ width: 13, height: 13 }} className="text-slate-300 shrink-0" />
                  : <DeleteCategoryButton id={c.id} />
                }
              </div>
            ))}
          </div>
          <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/40 rounded-b-[20px]">
            <AddCategoryForm defaultType="expense" />
          </div>
        </div>
      </div>
    </div>
  )
}
