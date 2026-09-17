import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { User, Home, Zap, XCircle, UserX } from 'lucide-react'
import { ShowingStatusBadge } from '@/features/showings/components/ShowingStatusBadge'
import { ShowingResultForm } from '@/features/showings/components/ShowingResultForm'
import { deleteShowingAction, updateShowingStatusAction } from '@/features/showings/actions/showings.actions'
import { ServerActionForm } from '@/components/forms/ServerActionForm'
import { SendByEmailForm } from '@/components/forms/SendByEmailForm'
import { sendShowingInviteAction } from '@/features/showings/actions/notify.actions'
import { PageHeader } from '@/components/layout/PageHeader'
import { RecordActions } from '@/components/layout/RecordActions'
import { ConfirmDeleteButton } from '@/components/forms/ConfirmDeleteButton'
import { formatAmount } from '@/lib/utils'
import { formatDateTime } from '@/lib/timezone'

const RESULT_LABELS: Record<string, string> = {
  interested: 'Заинтересован', thinking: 'Думает', not_interested: 'Не заинтересован',
}

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
      contact:contacts(id, full_name, phone, email),
      agent:users!showings_agent_id_fkey(id, full_name, phone),
      deal:deals(id, deal_number, deal_type)
    `)
    .eq('id', id)
    .single()

  if (rawError && rawError.code !== 'PGRST116') {
    throw new Error(`Не удалось загрузить показ: ${rawError.message}`)
  }
  if (!raw) notFound()
  const showing = raw
  const deal = showing.deal as { id: string; deal_number: number | null; deal_type: string } | null

  const cancelAction = updateShowingStatusAction.bind(null, id, 'cancelled')
  const noShowAction = updateShowingStatusAction.bind(null, id, 'no_show')
  const whenLabel = formatDateTime(showing.scheduled_at, { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const client = showing.contact ?? showing.lead

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <PageHeader
        crumbs={[{ label: 'Показы', href: '/showings' }, { label: whenLabel }]}
        title={showing.property?.title ? `Показ · ${showing.property.title}` : 'Показ объекта'}
        badges={<ShowingStatusBadge status={showing.status} />}
        meta={
          <>
            <span>{whenLabel}</span>
            <span className="sep">·</span>
            <span>{showing.duration_min} мин</span>
            {showing.agent?.full_name && (<><span className="sep">·</span><span>риелтор {showing.agent.full_name}</span></>)}
          </>
        }
        actions={
          <RecordActions
            /* Главное действие запланированного показа — записать, чем он кончился;
               форма результата прямо под шапкой. Отмена — в «…». */
            more={
              <>
                {showing.status === 'planned' && (
                  <ServerActionForm action={noShowAction}>
                    <button type="submit" className="hp-menu-item" role="menuitem">
                      <UserX className="w-4 h-4" />
                      Клиент не пришёл
                    </button>
                  </ServerActionForm>
                )}
                {showing.status !== 'cancelled' && (
                  <ServerActionForm action={cancelAction}>
                    <button type="submit" className="hp-menu-item" role="menuitem">
                      <XCircle className="w-4 h-4" />
                      Отменить показ
                    </button>
                  </ServerActionForm>
                )}
                <ConfirmDeleteButton
                  action={deleteShowingAction.bind(null, id)}
                  confirmText="Удалить показ? Он пропадёт из календаря и истории клиента. Отменить нельзя."
                  label="Удалить показ"
                />
              </>
            }
          />
        }
      />

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 space-y-4">
          {showing.status === 'planned' && (
            <div className="hp-block">
              <div className="hp-block-header">Результат показа</div>
              <div className="px-[18px] py-3">
                <ShowingResultForm showingId={id} />
              </div>
            </div>
          )}

          {showing.status === 'completed' && (
            <div className="hp-block">
              <div className="hp-block-header">Итоги показа</div>
              <div className="hp-block-row">
                <span className="label">Результат</span>
                <span className="value">{showing.result ? RESULT_LABELS[showing.result] ?? showing.result : '—'}</span>
              </div>
              {showing.feedback && (
                <div className="hp-block-row"><span className="label">Обратная связь</span><span className="value">{showing.feedback}</span></div>
              )}
              {showing.next_step && (
                <div className="hp-block-row"><span className="label">Следующий шаг</span><span className="value">{showing.next_step}</span></div>
              )}
            </div>
          )}

          {/* Приглашение клиенту: письмо с вложением .ics, чтобы показ попал
              к нему в календарь и напомнил о себе сам. */}
          {showing.status === 'planned' && (
            <SendByEmailForm
              action={sendShowingInviteAction.bind(null, id)}
              defaultEmail={showing.contact?.email ?? showing.lead?.email ?? null}
              title="Отправить приглашение клиенту"
              hint="В письме — время, адрес, контакты риелтора и файл для календаря."
              submitLabel="Отправить приглашение"
              withComment={false}
            />
          )}

          {showing.status === 'planned' && showing.feedback && (
            <div className="hp-block">
              <div className="hp-block-header">Заметки</div>
              <p className="px-[18px] py-3 text-sm text-[var(--hp-sub)] whitespace-pre-wrap">{showing.feedback}</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="hp-block">
            <div className="hp-block-header">Участники</div>
            {client ? (
              <Link href={showing.contact ? `/contacts/${showing.contact.id}` : `/leads/${showing.lead!.id}`} className="hp-block-item">
                <User className="w-4 h-4 shrink-0 text-[var(--hp-sub)]" />
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-[var(--hp-ink)] font-medium">{client.full_name}</span>
                  <span className="block text-[11.5px] text-[var(--hp-sub)]">{showing.contact ? 'Клиент' : 'Лид'}{client.phone ? ` · ${client.phone}` : ''}</span>
                </span>
              </Link>
            ) : (
              <div className="hp-block-item text-[var(--hp-tertiary)]"><User className="w-4 h-4 shrink-0" />Клиент не указан</div>
            )}
            {showing.agent && (
              <div className="hp-block-item">
                <User className="w-4 h-4 shrink-0 text-[var(--hp-sub)]" />
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-[var(--hp-ink)] font-medium">{showing.agent.full_name}</span>
                  <span className="block text-[11.5px] text-[var(--hp-sub)]">Риелтор{showing.agent.phone ? ` · ${showing.agent.phone}` : ''}</span>
                </span>
              </div>
            )}
          </div>

          <div className="hp-block">
            <div className="hp-block-header">Объект и сделка</div>
            {showing.property ? (
              <Link href={`/properties/${showing.property.id}`} className="hp-block-item">
                <Home className="w-4 h-4 shrink-0 text-[var(--hp-sub)]" />
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-[var(--hp-ink)] font-medium">{showing.property.title}</span>
                  <span className="block text-[11.5px] text-[var(--hp-sub)] truncate">
                    {showing.property.address ?? ''}{showing.property.price ? ` · ${formatAmount(showing.property.price)} ₽` : ''}
                  </span>
                </span>
              </Link>
            ) : (
              <div className="hp-block-item text-[var(--hp-tertiary)]"><Home className="w-4 h-4 shrink-0" />Объект не указан</div>
            )}
            {deal && (
              <Link href={`/deals/${deal.id}`} className="hp-block-item">
                <Zap className="w-4 h-4 shrink-0 text-[var(--hp-sub)]" />
                <span className="flex-1 min-w-0 truncate text-[var(--hp-ink)] font-medium">Сделка {deal.deal_number ? `СД-${deal.deal_number}` : ''}</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
