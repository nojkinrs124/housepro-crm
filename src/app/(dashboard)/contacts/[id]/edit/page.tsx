import { createClient } from '@/lib/supabase/server'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { updateContactAction } from '@/features/contacts/actions/contacts.actions'
import type { Contact } from '@/types/database'

export default async function EditContactPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: contact } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!contact) notFound()

  const c = contact as Contact
  const boundAction = updateContactAction.bind(null, params.id)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href={`/contacts/${params.id}`} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition">
        <ArrowLeft className="w-4 h-4" />
        Вернуться к контакту
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Редактировать контакт</h1>
        <p className="text-muted-foreground mt-1">{c.full_name}</p>
      </div>

      <form action={boundAction} className="bg-card border border-border rounded-2xl p-6 space-y-5">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Полное имя *
          </label>
          <input
            type="text"
            name="full_name"
            required
            defaultValue={c.full_name}
            className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
        </div>

        {/* Role */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Роль *
          </label>
          <select
            name="role"
            required
            defaultValue={c.role}
            className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary"
          >
            <option value="client">👥 Клиент</option>
            <option value="owner">🏠 Собственник</option>
            <option value="both">🔄 Клиент + Собственник</option>
          </select>
        </div>

        {/* Contact Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Телефон
            </label>
            <input
              type="tel"
              name="phone"
              defaultValue={c.phone || ''}
              className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Email
            </label>
            <input
              type="email"
              name="email"
              defaultValue={c.email || ''}
              className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Comment */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Комментарий
          </label>
          <textarea
            name="comment"
            rows={4}
            defaultValue={c.comment || ''}
            className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
        </div>

        <button
          type="submit"
          className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition"
        >
          Сохранить изменения
        </button>
      </form>
    </div>
  )
}
