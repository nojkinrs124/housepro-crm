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
      <Link
        href="/settings"
        className="inline-flex items-center gap-2 text-sm font-medium text-[#64748B] hover:text-[#111827] transition-colors"
      >
        <ArrowLeft style={{ width: 16, height: 16 }} />
        Настройки
      </Link>

      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0 bg-green-50">
          <UserCircle className="text-[#16A34A]" style={{ width: 20, height: 20 }} />
        </div>
        <div>
          <h1 className="text-[28px] font-bold text-[#111827] tracking-tight leading-tight">Профиль</h1>
          <p className="text-[#64748B] text-sm font-medium mt-0.5">Личные данные и безопасность</p>
        </div>
      </div>

      <ProfileForm user={profile} />
    </div>
  )
}
