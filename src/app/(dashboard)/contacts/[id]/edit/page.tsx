import { createClient } from '@/lib/supabase/server'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { updateContactAction } from '@/features/contacts/actions/contacts.actions'
import { ContactForm } from '@/features/contacts/components/ContactForm'
import { PageHeader } from '@/components/layout/PageHeader'

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: c } = await supabase.from('contacts').select('*').eq('id', id).single()
  if (!c) notFound()

  const boundAction = updateContactAction.bind(null, id)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Редактировать контакт"
        subtitle={c.full_name}
        backHref={`/contacts/${id}`}
        backLabel="Вернуться к контакту"
      />

      <ContactForm
        action={boundAction}
        defaults={c}
        backHref={`/contacts/${id}`}
        submitLabel="Сохранить изменения"
      />
    </div>
  )
}
