import { createTaskAction } from '@/features/tasks/actions/tasks.actions'
import { createClient } from '@/lib/supabase/server'
import { CheckSquare } from 'lucide-react'
import { ServerActionForm } from '@/components/forms/ServerActionForm'
import { Field, FieldGrid, FormActions, FormExtra, FormSection } from '@/components/forms/FormLayout'
import { PageHeader } from '@/components/layout/PageHeader'
import { ContactSelectField } from '@/features/contacts/components/ContactSelectField'
import { PropertySelectField } from '@/features/properties/components/PropertySelectField'
import { DEAL_TYPE_LABELS } from '@/features/deals/config/deal-stages'

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{
    lead_id?: string; contact_id?: string; client_id?: string; deal_id?: string;
    property_id?: string; contract_id?: string; payment_id?: string;
  }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  // Загружаем все сущности для привязки
  const [{ data: users }, { data: clients }, { data: deals }, { data: properties }, { data: contracts }] = await Promise.all([
    supabase.from('users').select('id, full_name').eq('is_active', true).order('full_name'),
    supabase.from('contacts').select('id, full_name').order('full_name'),
    supabase.from('deals').select('id, deal_type, deal_number, created_at').order('created_at', { ascending: false }).limit(50),
    supabase.from('properties').select('id, title, address').order('title').limit(50),
    supabase.from('contracts').select('id, contract_number').order('created_at', { ascending: false }).limit(50),
  ])

  // Задача, поставленная с карточки сделки/контакта/объекта, уже привязана —
  // блок связей раскрываем, чтобы человек видел, к чему она относится.
  const linkedFromRecord = Boolean(params.lead_id || params.deal_id || params.contact_id || params.client_id || params.property_id || params.contract_id)

  // Задача с карточки лида: показываем, к кому она относится, — раньше лид
  // уходил скрытым полем, и на форме было не видно связи (проход 17.09.2026, L-5).
  const { data: lead } = params.lead_id
    ? await supabase.from('leads').select('id, full_name, phone').eq('id', params.lead_id).maybeSingle()
    : { data: null }
  const onlyOneUser = (users?.length ?? 0) <= 1

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Новая задача"
        subtitle="Что сделать и к какому сроку — остальное можно уточнить позже"
        backHref="/tasks"
        backLabel="Назад к задачам"
        icon={<CheckSquare className="w-5 h-5 text-[var(--hp-ink)]" />}
      />

      <ServerActionForm action={createTaskAction} className="space-y-4">
        <FormSection>
          <Field label="Что сделать" required>
            <input name="title" data-testid="task-title" required placeholder="Позвонить клиенту по договору" className="hp-input" />
          </Field>
          <FieldGrid>
            <Field label="Срок">
              <input name="deadline" type="datetime-local" className="hp-input min-w-0" />
            </Field>
            <Field label="Приоритет">
              <select name="priority" defaultValue="medium" className="hp-input cursor-pointer">
                <option value="low">Низкий</option>
                <option value="medium">Средний</option>
                <option value="high">Высокий</option>
              </select>
            </Field>
          </FieldGrid>
          {/* Один сотрудник в системе — выбирать некого, поле не показываем;
              экшен назначит задачу на себя. */}
          {!onlyOneUser && (
            <Field label="Исполнитель">
              <select name="assigned_to" className="hp-input cursor-pointer">
                <option value="">Себе</option>
                {(users ?? []).map(u => (
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
              </select>
            </Field>
          )}
        </FormSection>

        <FormExtra summary="описание, связь с контактом, сделкой, объектом или договором" defaultOpen={linkedFromRecord}>
          <Field label="Описание">
            <textarea name="description" rows={3} placeholder="Подробности задачи…" className="hp-input !h-auto py-2.5 resize-none" />
          </Field>
          <FieldGrid>
            <ContactSelectField
              contacts={clients ?? []}
              defaultContactId={params.contact_id ?? params.client_id ?? ''}
              name="contact_id"
              label="Контакт"
              role="both"
              placeholder="— не выбрано —"
            />
            <Field label="Сделка">
              <select name="deal_id" defaultValue={params.deal_id ?? ''} className="hp-input cursor-pointer">
                <option value="">— не выбрано —</option>
                {(deals ?? []).map(d => (
                  <option key={d.id} value={d.id}>
                    {d.deal_number ? `СД-${d.deal_number} · ` : ''}{DEAL_TYPE_LABELS[d.deal_type] ?? d.deal_type}
                  </option>
                ))}
              </select>
            </Field>
            <PropertySelectField properties={properties ?? []} defaultPropertyId={params.property_id ?? ''} />
            <Field label="Договор">
              <select name="contract_id" defaultValue={params.contract_id ?? ''} className="hp-input cursor-pointer">
                <option value="">— не выбрано —</option>
                {(contracts ?? []).map(c => (
                  <option key={c.id} value={c.id}>{c.contract_number ?? `#${c.id.slice(0, 8)}`}</option>
                ))}
              </select>
            </Field>
          </FieldGrid>
          {lead && (
            <Field label="Лид">
              <input type="hidden" name="lead_id" value={lead.id} />
              <input readOnly value={`${lead.full_name || 'Без имени'}${lead.phone ? ` · ${lead.phone}` : ''}`} className="hp-input bg-[var(--hp-neutral-tint)]" />
            </Field>
          )}
        </FormExtra>

        <FormActions submitLabel="Создать задачу" cancelHref="/tasks" submitTestId="task-submit" />
      </ServerActionForm>
    </div>
  )
}
