import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { createContactAction } from '@/features/contacts/actions/contacts.actions'
import { ContactForm } from '@/features/contacts/components/ContactForm'

export default function NewContactPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/contacts" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Вернуться к контактам
      </Link>

      <div>
        <h1 className="text-[28px] font-bold text-[#111827] tracking-tight leading-tight">Добавить контакт</h1>
        <p className="text-muted-foreground mt-1">Физлицо или юрлицо · клиент, собственник или оба</p>
      </div>

      <ContactForm
        action={createContactAction}
        backHref="/contacts"
        submitLabel="Добавить контакт"
      />
    </div>
  )
}
