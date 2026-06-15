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
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Настройки
      </Link>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
          <Shield className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h1 className="text-[28px] font-bold text-foreground leading-tight">Безопасность</h1>
          <p className="text-sm text-muted-foreground">Пароль, сессии, аутентификация</p>
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
