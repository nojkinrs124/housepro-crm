import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Eye } from 'lucide-react'
import { createShowingAction } from '@/features/showings/actions/showings.actions'
import { ServerActionForm } from '@/components/forms/ServerActionForm'
import { Field, FieldGrid, FormActions, FormExtra, FormSection } from '@/components/forms/FormLayout'
import { PageHeader } from '@/components/layout/PageHeader'
import { PropertySelectField } from '@/features/properties/components/PropertySelectField'
import { ContactSelectField } from '@/features/contacts/components/ContactSelectField'

/**
 * Показ планируется с карточки сделки, объекта или контакта — параметры из URL
 * подставляются в форму. Раньше форма их не читала, а клиента можно было
 * выбрать только среди лидов: человеку, который уже в контактах, показ
 * завести было нельзя.
 */
export default async function NewShowingPage({
  searchParams,
}: {
  searchParams: Promise<{ property_id?: string; deal_id?: string; contact_id?: string; lead_id?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: properties }, { data: contacts }, { data: leads }, { data: agents }] = await Promise.all([
    supabase.from('properties').select('id, title, address').order('created_at', { ascending: false }).limit(100),
    supabase.from('contacts').select('id, full_name, phone').in('role', ['client', 'both']).order('full_name').limit(200),
    supabase.from('leads').select('id, full_name').in('status', ['new', 'contacted', 'showing', 'searching']).order('created_at', { ascending: false }).limit(100),
    supabase.from('users').select('id, full_name').eq('is_active', true).order('full_name'),
  ])
  const onlyOneAgent = (agents?.length ?? 0) <= 1

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Новый показ"
        subtitle="Кому, что и когда показываем — приглашение клиенту уйдёт письмом с карточки показа"
        backHref="/showings"
        backLabel="Назад к показам"
        icon={<Eye className="w-5 h-5 text-[var(--hp-ink)]" />}
      />

      <ServerActionForm action={createShowingAction} className="space-y-4">
        <FormSection>
          <PropertySelectField properties={properties ?? []} defaultPropertyId={params.property_id ?? ''} />
          <FieldGrid>
            <ContactSelectField
              contacts={contacts ?? []}
              defaultContactId={params.contact_id ?? ''}
              name="contact_id"
              label="Клиент"
              role="client"
              placeholder="— выберите клиента —"
            />
            <Field label="Дата и время" required>
              <input type="datetime-local" name="scheduled_at" required className="hp-input min-w-0" data-testid="showing-datetime" />
            </Field>
            <Field label="Длительность">
              <select name="duration_min" defaultValue="30" className="hp-input cursor-pointer">
                <option value="15">15 мин</option>
                <option value="30">30 мин</option>
                <option value="45">45 мин</option>
                <option value="60">1 час</option>
                <option value="90">1,5 часа</option>
                <option value="120">2 часа</option>
              </select>
            </Field>
            {!onlyOneAgent && (
              <Field label="Риелтор">
                <select name="agent_id" defaultValue={user.id} className="hp-input cursor-pointer">
                  {agents?.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                </select>
              </Field>
            )}
          </FieldGrid>
          {params.deal_id && <input type="hidden" name="deal_id" value={params.deal_id} />}
        </FormSection>

        <FormExtra summary="лид (если клиента ещё нет в контактах), заметки к показу" defaultOpen={Boolean(params.lead_id)}>
          <FieldGrid>
            <Field label="Лид" hint="Если человек ещё не переведён в контакты">
              <select name="lead_id" defaultValue={params.lead_id ?? ''} className="hp-input cursor-pointer">
                <option value="">— не выбран —</option>
                {leads?.map(l => <option key={l.id} value={l.id}>{l.full_name}</option>)}
              </select>
            </Field>
          </FieldGrid>
          <Field label="Заметки">
            <textarea name="feedback" rows={3} placeholder="Пожелания, особенности показа…" className="hp-input !h-auto py-2.5 resize-none" />
          </Field>
        </FormExtra>

        <FormActions submitLabel="Запланировать показ" cancelHref="/showings" submitTestId="showing-submit" />
      </ServerActionForm>
    </div>
  )
}
