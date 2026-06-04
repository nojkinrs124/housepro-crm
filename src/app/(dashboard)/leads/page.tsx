import { createClient } from '@/lib/supabase/server'
import { Plus, Zap } from 'lucide-react'
import Link from 'next/link'
import { LeadsKanban } from '@/features/leads/components/LeadsKanban'

export default async function LeadsPage() {
  const supabase = await createClient()
  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })

  const total    = leads?.length ?? 0
  const newCount = (leads ?? []).filter(l => l.status === 'new').length
  const converted = (leads ?? []).filter(l => l.status === 'converted').length

  return (
    <div className="space-y-6 max-w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Лиды</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {total} всего · {newCount} новых · {converted} конвертировано
          </p>
        </div>
        <Link href="/leads/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all">
          <Plus className="w-4 h-4" />
          Новый лид
        </Link>
      </div>

      {total === 0 ? (
        <div className="bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-12 text-center">
          <Zap className="w-12 h-12 text-primary mx-auto mb-4 opacity-40" />
          <h3 className="font-semibold text-foreground">Нет лидов</h3>
          <p className="text-muted-foreground text-sm mt-1">Добавьте первый лид из входящего обращения</p>
          <Link href="/leads/new"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition">
            <Plus className="w-4 h-4" />
            Добавить лид
          </Link>
        </div>
      ) : (
        <LeadsKanban leads={leads ?? []} />
      )}
    </div>
  )
}
