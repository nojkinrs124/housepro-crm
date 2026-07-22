import { randomBytes } from 'crypto'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null) ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  )
}

/**
 * Создаёт короткую отслеживаемую ссылку /r/{code} → destinationUrl.
 * destinationUrl — куда ведём в итоге: t.me/username (личка админа) или t.me/botusername (бот-квалификатор).
 */
export async function createChannelLink(
  orgId: string,
  postId: string | null,
  destinationUrl: string,
  label?: string
): Promise<string> {
  const code = randomBytes(4).toString('hex') // 8 символов, достаточно для канала с невысоким трафиком
  const supabaseAdmin = getSupabaseAdmin()
  const { error } = await supabaseAdmin
    .from('channel_links')
    .insert({ code, organization_id: orgId, post_id: postId, destination_url: destinationUrl, label })
  if (error) throw new Error(`createChannelLink: ${error.message}`)
  return `${siteUrl()}/r/${code}`
}
