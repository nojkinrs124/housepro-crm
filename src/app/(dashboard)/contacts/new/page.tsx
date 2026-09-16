import { createContactAction } from '@/features/contacts/actions/contacts.actions'
import { ContactForm } from '@/features/contacts/components/ContactForm'
import { PageHeader } from '@/components/layout/PageHeader'

export default function NewContactPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Новый контакт"
        subtitle="Достаточно имени и телефона — остальное заполните позже"
        backHref="/contacts"
        backLabel="Вернуться к контактам"
      />

      <ContactForm
        action={createContactAction}
        backHref="/contacts"
        submitLabel="Создать контакт"
      />
    </div>
  )
}
