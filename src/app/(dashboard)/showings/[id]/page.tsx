import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Calendar, Clock, User, Home, FileText, Trash2 } from 'lucide-react'
import { ShowingStatusBadge } from '@/features/showings/components/ShowingStatusBadge'
import { ShowingResultForm } from '@/features/showings/components/ShowingResultForm'
import { DeleteShowingButton } from '@/features/showings/components/DeleteShowingButton'
import { deleteShowingAction, updateShowingStatusAction } from '@/features/showings/actions/showings.actions'
import { ServerActionForm } from '@/components/forms/ServerActionForm'

export default async function ShowingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: raw, error: rawError } = await supabase
    .from('showings')
    .select(`
      *,
      property:properties(id, title, address, deal_type, price),
      lead:leads(id, full_name, phone, email),
      agent:users!showings_agent_id_fkey(id, full_name, phone)
    `)
    .eq('id', id)
    .single()

  if (rawError && rawError.code !== 'PGRST116') {
    throw new Error(`Не удалось загрузить показ: ${rawError.message}`)
  }
  if (!raw) notFound()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const showing = raw as any

  const cancelAction = updateShowingStatusAction.bind(null, id, 'cancelled')

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/showings" className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">Показ объекта</h1>
              <ShowingStatusBadge status={showing.status} />
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {new Date(showing.scheduled_at).toLocaleString('ru-RU', {
                day: '2-digit', month: 'long', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
          </div>
        </div>

        {showing.status !== 'cancelled' && (
          <ServerActionForm action={cancelAction}>
            <button type="submit" className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-50 hover:text-red-600 hover:border-red-200 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
              Отменить показ
            </button>
          </ServerActionForm>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main */}
        <div className="lg:col-span-2 space-y-5">
          {/* Property */}
          {showing.property && (
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5">
              <h2 className="font-semibold mb-3 flex items-center gap-2">
                <Home className="w-4 h-4 text-primary" />
                Объект
              </h2>
              <Link href={`/properties/${showing.property.id}`} className="hover:underline font-medium">
                {showing.property.title}
              </Link>
              {showing.property.address && (
                <p className="text-sm text-muted-foreground mt-1">{showing.property.address}</p>
              )}
              {showing.property.price && (
                <p className="text-sm font-medium mt-2">
                  {Number(showing.property.price).toLocaleString('ru-RU')} ₽
                </p>
              )}
            </div>
          )}

          {/* Result form (only if planned) */}
          {showing.status === 'planned' && (
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5">
              <h2 className="font-semibold mb-4">Результат показа</h2>
              <ShowingResultForm showingId={id} />
            </div>
          )}

          {/* Completed result */}
          {showing.status === 'completed' && (
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 space-y-3">
              <h2 className="font-semibold">Итоги показа</h2>
              {showing.result && (
                <div>
                  <span className="text-xs text-muted-foreground">Результат</span>
                  <p className="text-sm font-medium mt-0.5">{
                    showing.result === 'interested' ? '✅ Заинтересован' :
                    showing.result === 'thinking'   ? '🤔 Думает' : '❌ Не заинтересован'
                  }</p>
                </div>
              )}
              {showing.feedback && (
                <div>
                  <span className="text-xs text-muted-foreground">Обратная связь</span>
                  <p className="text-sm mt-0.5">{showing.feedback}</p>
                </div>
              )}
              {showing.next_step && (
                <div>
                  <span className="text-xs text-muted-foreground">Следующий шаг</span>
                  <p className="text-sm mt-0.5">{showing.next_step}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 space-y-4">
            <h2 className="font-semibold">Информация</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-muted-foreground text-xs">Дата и время</div>
                  <div className="font-medium">
                    {new Date(showing.scheduled_at).toLocaleString('ru-RU', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-muted-foreground text-xs">Длительность</div>
                  <div className="font-medium">{showing.duration_min} мин</div>
                </div>
              </div>
              {showing.agent && (
                <div className="flex items-start gap-2">
                  <User className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-muted-foreground text-xs">Агент</div>
                    <div className="font-medium">{showing.agent.full_name}</div>
                    {showing.agent.phone && <div className="text-muted-foreground">{showing.agent.phone}</div>}
                  </div>
                </div>
              )}
              {showing.lead && (
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-muted-foreground text-xs">Клиент (лид)</div>
                    <Link href={`/leads/${showing.lead.id}`} className="font-medium hover:underline">
                      {showing.lead.full_name}
                    </Link>
                    {showing.lead.phone && <div className="text-muted-foreground">{showing.lead.phone}</div>}
                  </div>
                </div>
              )}
            </div>
          </div>

          <DeleteShowingButton id={id} />
        </div>
      </div>
    </div>
  )
}
