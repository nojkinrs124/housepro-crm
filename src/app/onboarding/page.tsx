import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OnboardingWizard } from './OnboardingWizard'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // If already completed → go to dashboard
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, onboarding_completed')
    .eq('id', (await import('@/lib/org').then(m => m.getOrgId())) ?? '')
    .single()

  if (org?.onboarding_completed) redirect('/dashboard')

  const { data: employees } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('is_active', true)
    .order('full_name')

  return (
    <OnboardingWizard
      orgId={org?.id ?? ''}
      orgName={org?.name ?? ''}
      userId={user.id}
      employees={employees ?? []}
    />
  )
}
