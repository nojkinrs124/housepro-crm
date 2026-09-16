import { createPropertyAction } from '@/features/properties/actions/properties.actions'
import { createClient } from '@/lib/supabase/server'
import { Home } from 'lucide-react'
import { ServerActionForm } from '@/components/forms/ServerActionForm'
import { Field, FormActions, FormSection } from '@/components/forms/FormLayout'
import { PageHeader } from '@/components/layout/PageHeader'
import { PropertyFormBody } from '@/features/properties/components/PropertyFormBody'

export default async function NewPropertyPage({
  searchParams,
}: {
  searchParams: Promise<{ deal_type?: string }>
}) {
  // Раздел «Управление» приводит сюда со ссылкой ?deal_type=management —
  // иначе объект пришлось бы вручную переключать после создания.
  const { deal_type: dealTypeParam } = await searchParams
  const dealTypes = ['rent', 'sale', 'management', 'subrent']
  const defaultDealType = dealTypes.includes(dealTypeParam ?? '') ? dealTypeParam! : 'rent'
  const supabase = await createClient()
  const { data: owners } = await supabase.from('contacts').select('id, full_name, phone').in('role', ['owner', 'both']).order('full_name')

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Новый объект"
        subtitle="Достаточно названия и адреса — параметры и документы заполните перед публикацией"
        backHref="/properties"
        backLabel="Назад к объектам"
        icon={<Home className="w-5 h-5 text-[var(--hp-ink)]" />}
      />

      <ServerActionForm action={createPropertyAction} className="space-y-4">
        <PropertyFormBody
          owners={owners ?? []}
          defaultDealType={defaultDealType}
          descriptionSlot={
            <FormSection title="Описание">
              <Field label="Текст для площадок" hint="Уходит на Авито, ЦИАН и Домклик. Можно оставить пустым и сгенерировать после сохранения">
                <textarea name="description" rows={4} placeholder="Описание объекта…" className="hp-input !h-auto py-2.5 resize-y" />
              </Field>
            </FormSection>
          }
        />
        <FormActions submitLabel="Создать объект" cancelHref="/properties" submitTestId="property-submit" />
      </ServerActionForm>
    </div>
  )
}
