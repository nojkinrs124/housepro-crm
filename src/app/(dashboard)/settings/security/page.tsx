import { createClient } from '@/lib/supabase/server'
import { Shield } from 'lucide-react'
import { redirect } from 'next/navigation'
import { SecuritySettingsForm } from '@/features/settings/components/SecuritySettingsForm'
import { getSecurityInfoAction } from '@/features/settings/actions/security.actions'
import { PageHeader } from '@/components/layout/PageHeader'

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
      <PageHeader
        title="Безопасность"
        subtitle="Пароль, сессии, аутентификация"
        backHref="/settings"
        backLabel="Настройки"
        icon={<Shield className="text-[var(--hp-accent)]" style={{ width: 20, height: 20 }} />}
      />

      <SecuritySettingsForm
        email={info.user?.email ?? ''}
        lastSignIn={info.user?.lastSignIn ?? null}
        createdAt={info.user?.createdAt ?? null}
      />
    </div>
  )
}
