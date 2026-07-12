import { createClient } from '@/lib/supabase/server'
import { UserCircle } from 'lucide-react'
import { redirect } from 'next/navigation'
import { ProfileForm } from '@/features/profile/components/ProfileForm'
import { PageHeader } from '@/components/layout/PageHeader'

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
      <PageHeader
        title="Профиль"
        subtitle="Личные данные и безопасность"
        backHref="/settings"
        backLabel="Настройки"
        icon={<UserCircle className="text-[#16A34A]" style={{ width: 20, height: 20 }} />}
      />

      <ProfileForm user={profile} />
    </div>
  )
}
