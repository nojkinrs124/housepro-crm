import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createCollectionAction } from '@/features/collections/actions/collections.actions'
import { formAction } from '@/lib/form-action'

export default async function NewCollectionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: leads } = await supabase
    .from('leads')
    .select('id, full_name')
    .in('status', ['new','contacted','showing','searching'])
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/collections" className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-muted-foreground">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-xl font-bold">Новая подборка</h1>
      </div>

      <form action={formAction(createCollectionAction)} className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Название <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="title"
            required
            placeholder="Например: 3-комнатные на Арбате для Ивановых"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Привязать к лиду</label>
          <select
            name="lead_id"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">— Выбрать лида (необязательно) —</option>
            {leads?.map(l => (
              <option key={l.id} value={l.id}>{l.full_name}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Создать подборку
          </button>
          <Link
            href="/collections"
            className="px-5 py-2.5 border border-slate-200 text-foreground rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            Отмена
          </Link>
        </div>
      </form>
    </div>
  )
}
