import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const supabaseAdmin = getSupabaseAdmin()

  const { data: link } = await supabaseAdmin
    .from('channel_links')
    .select('destination_url')
    .eq('code', code)
    .maybeSingle()

  if (!link?.destination_url) {
    return NextResponse.redirect(new URL('/', request.url), { status: 302 })
  }

  // Не блокируем редирект логированием — пользователь не должен ждать инсерт в базу.
  supabaseAdmin
    .from('channel_link_clicks')
    .insert({
      code,
      user_agent: request.headers.get('user-agent') ?? null,
      referer: request.headers.get('referer') ?? null,
    })
    .then(({ error }) => {
      if (error) console.error('[channel-links] click log error:', error)
    })

  return NextResponse.redirect(link.destination_url, { status: 302 })
}
