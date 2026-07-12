import { createContactAction } from '@/features/contacts/actions/contacts.actions'
import { ContactForm } from '@/features/contacts/components/ContactForm'
import { PageHeader } from '@/components/layout/PageHeader'

export default function NewContactPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Добавить контакт"
        subtitle="Физлицо или юрлицо · клиент, собственник или оба"
        backHref="/contacts"
        backLabel="Вернуться к контактам"
      />

      <ContactForm
        action={createContactAction}
        backHref="/contacts"
        submitLabel="Добавить контакт"
      />
    </div>
  )
}
