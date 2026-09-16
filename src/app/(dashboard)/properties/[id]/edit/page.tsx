import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { updatePropertyAction } from '@/features/properties/actions/properties.actions'
import { ServerActionForm } from '@/components/forms/ServerActionForm'
import { FormActions, FormSection } from '@/components/forms/FormLayout'
import { PageHeader } from '@/components/layout/PageHeader'
import { PropertyPhotosManager } from '@/features/properties/components/PropertyPhotosManager'
import { PropertyFormBody } from '@/features/properties/components/PropertyFormBody'
import { GenerateListingButton } from '@/features/properties/components/GenerateListingButton'
import { propertyListingFacts } from '@/lib/ai/listing/facts'

export default async function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: rawProperty }, { data: owners }] = await Promise.all([
    supabase.from('properties').select('*').eq('id', id).single(),
    supabase.from('contacts').select('id, full_name, phone').in('role', ['owner', 'both']).order('full_name'),
  ])

  if (!rawProperty) notFound()

  const p = rawProperty
  const boundAction = updatePropertyAction.bind(null, id)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Редактировать объект"
        subtitle={p.title}
        backHref={`/properties/${id}`}
        backLabel="Вернуться к объекту"
      />

      {/* Фотографии — управляются отдельно от формы, сохраняются сразу при загрузке */}
      <FormSection title="Фотографии">
        <PropertyPhotosManager propertyId={id} initialPhotos={p.photo_urls ?? []} />
      </FormSection>

      <ServerActionForm action={boundAction} className="space-y-4">
        <PropertyFormBody
          property={p}
          owners={owners ?? []}
          showStatus
          descriptionSlot={
            /* Описание — этот текст уходит в фиды Авито/ЦИАН/Домклик. Генератор пишет
               результат прямо сюда (и в базу), так что отдельного поля «объявление» на
               экране нет; listing_* хранят заголовок, вводные и модель последней генерации. */
            <FormSection>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="hp-h2">Описание</h2>
                  <p className="text-xs text-[var(--hp-sub)] mt-1">
                    Уходит на Авито, ЦИАН и Домклик. Генератор берёт сохранённые поля объекта — если меняли
                    их выше, сначала «Сохранить изменения».
                    {p.listing_generated_at && (
                      <> Последняя генерация: {new Date(p.listing_generated_at).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}{p.listing_model ? ` · ${p.listing_model}` : ''}.</>
                    )}
                  </p>
                </div>
                <GenerateListingButton
                  propertyId={id}
                  facts={propertyListingFacts(p)}
                  initialRawInput={p.listing_raw_input ?? ''}
                />
              </div>
              <textarea id="property-description" name="description" rows={10} defaultValue={p.description ?? ''}
                placeholder="Описание для публикации на Авито, ЦИАН, Домклик…"
                className="hp-input !h-auto py-2.5 resize-y" />
            </FormSection>
          }
        />
        <FormActions submitLabel="Сохранить изменения" cancelHref={`/properties/${id}`} />
      </ServerActionForm>
    </div>
  )
}
