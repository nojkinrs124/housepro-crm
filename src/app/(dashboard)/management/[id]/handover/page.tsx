import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { HandoverForm, type HandoverDefaults } from '@/features/management/components/HandoverForm'
import { can, toUserRole } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

function items(value: unknown): { title: string; condition?: string }[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((i): i is { title: string; condition?: string } =>
      typeof i === 'object' && i !== null && typeof (i as { title?: unknown }).title === 'string')
}

/** Акт приёма объекта в управление — вход в обслуживание. */
export default async function HandoverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  if (!can(toUserRole(profile?.role), 'contracts', 'update')) redirect(`/management/${id}`)

  const [{ data: engagement }, { data: property }, { data: meters }] = await Promise.all([
    supabase.from('management_engagements')
      .select('id, started_at, handover:property_handovers(id, inventory, documents, condition_note, keys_count, completed_at)')
      .eq('property_id', id).is('ended_at', null).maybeSingle(),
    supabase.from('properties').select('title, address').eq('id', id).maybeSingle(),
    supabase.from('utility_meters')
      .select('id, title, kind, readings:meter_readings(reading_date)')
      .eq('property_id', id).eq('is_active', true),
  ])

  if (!engagement || !property) notFound()

  // Записи акта может не быть у обслуживания, заведённого миграцией. Это не
  // повод отдавать 404: объект в управлении существует, значит акт должен быть
  // заполняем — показываем пустой, а сохранение его создаст.
  const handover = (Array.isArray(engagement.handover) ? engagement.handover[0] : engagement.handover) ?? {
    id: null as string | null,
    inventory: [],
    documents: [],
    condition_note: null,
    keys_count: null,
    completed_at: null,
  }

  // Счётчики без начального показания — их видно до попытки закрыть акт,
  // чтобы не гонять человека на объект второй раз.
  const withoutInitial = (meters ?? []).filter(m => {
    const readings = Array.isArray(m.readings) ? m.readings : []
    return !readings.some(r => r.reading_date >= engagement.started_at)
  })

  const defaults: HandoverDefaults = {
    engagementId: engagement.id,
    inventory: items(handover.inventory),
    documents: items(handover.documents),
    conditionNote: handover.condition_note,
    keysCount: handover.keys_count,
    completedAt: handover.completed_at,
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Акт приёма объекта"
        subtitle={property.title}
        backHref={`/management/${id}`}
        backLabel="Объект"
      />

      {!handover.completed_at && (meters ?? []).length === 0 && (
        <p className="hp-card p-3 text-sm text-[var(--hp-warn)]">
          У объекта не заведено ни одного счётчика. Акт можно закрыть, но расход по
          коммунальным услугам считать будет не от чего.{' '}
          <Link href={`/management/${id}`} className="underline">Завести счётчики на карточке объекта</Link>
        </p>
      )}

      {!handover.completed_at && withoutInitial.length > 0 && (
        <p className="hp-card p-3 text-sm text-[var(--hp-warn)]">
          Нет начальных показаний по счётчикам: {withoutInitial.map(m => m.title || m.kind).join(', ')}.{' '}
          <Link href={`/management/${id}`} className="underline">Внести показания на карточке объекта</Link>
        </p>
      )}

      <HandoverForm defaults={defaults} backHref={`/management/${id}`} />
    </div>
  )
}
