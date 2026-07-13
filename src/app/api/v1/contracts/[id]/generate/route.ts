import { NextResponse } from 'next/server'
import { authenticateApiKey, hasScope } from '@/lib/api-auth'
import { generateContractDocxForOrg } from '@/features/contracts/actions/generate.actions'

// Node runtime обязателен (docxtemplater/Buffer — Node-only), НЕ ставить runtime='edge'.
export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiKey(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!hasScope(auth.scopes, 'write')) {
    return NextResponse.json({ error: 'Insufficient scope' }, { status: 403 })
  }

  const { id } = await params
  const result = await generateContractDocxForOrg(auth.orgId!, id)

  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ data: result })
}
