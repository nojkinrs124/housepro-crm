import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, Shield } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { SecuritySettingsForm } from '@/features/settings/components/SecuritySettingsForm'
import { getSecurityInfoAction } from '@/features/settings/actions/security.actions'

export default async function SecurityPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const result = await getSecurityInfoAction()
  if ('error' in result && result.error) redirect('/login')

  const info = result as Awaited<ReturnType<typeof getSecurityInfoAction>> & {
    user: { email: string; lastSignIn: string | null; createdAt: string | null }
  }

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
          <Shield className="text-[#16A34A]" style={{ width: 20, height: 20 }} />
        </div>
        <div>
          <h1 className="text-[28px] font-bold text-[#111827] tracking-tight leading-tight">Безопасность</h1>
          <p className="text-[#64748B] text-sm font-medium mt-0.5">Пароль, сессии, аутентификация</p>
        </div>
      </div>

      <SecuritySettingsForm
        email={info.user?.email ?? ''}
        lastSignIn={info.user?.lastSignIn ?? null}
        createdAt={info.user?.createdAt ?? null}
      />
    </div>
  )
}
