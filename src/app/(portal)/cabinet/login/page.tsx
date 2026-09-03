import { redirect } from 'next/navigation'
import { PortalLoginForm } from '@/features/portal/components/PortalLoginForm'
import { currentScope } from '@/features/portal/services/access.service'

export const dynamic = 'force-dynamic'

export default async function PortalLoginPage() {
  // Уже вошедшего незачем спрашивать снова.
  const scope = await currentScope()
  if (scope) redirect('/cabinet')

  return (
    <div className="max-w-md mx-auto pt-8">
      <PortalLoginForm />
    </div>
  )
}
