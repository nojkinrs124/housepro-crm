import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, UserCircle } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ProfileForm } from '@/features/profile/components/ProfileForm'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/settings"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Настройки
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <UserCircle className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Профиль</h1>
          <p className="text-sm text-muted-foreground">Личные данные и безопасность</p>
        </div>
      </div>

      <ProfileForm user={profile} />
    </div>
  )
}
