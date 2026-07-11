import { createClient } from '@/lib/supabase/server'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { updateContactAction } from '@/features/contacts/actions/contacts.actions'
import { ContactForm } from '@/features/contacts/components/ContactForm'

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: c } = await supabase.from('contacts').select('*').eq('id', id).single()
  if (!c) notFound()

  const boundAction = updateContactAction.bind(null, id)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href={`/contacts/${id}`} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Вернуться к контакту
      </Link>

      <div>
        <h1 className="text-[28px] font-bold text-foreground tracking-tight leading-tight">Редактировать контакт</h1>
        <p className="text-muted-foreground mt-1">{c.full_name}</p>
      </div>

      <ContactForm
        action={boundAction}
        defaults={c}
        backHref={`/contacts/${id}`}
        submitLabel="Сохранить изменения"
      />
    </div>
  )
}
