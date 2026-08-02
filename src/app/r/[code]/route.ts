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

  // Дожидаемся инсерта: без await serverless-функция завершается сразу после редиректа,
  // а fetch к Supabase обрывается на середине TLS-хендшейка (ECONNRESET) — лишние мс
  // на редирект незаметны, а лог кликов надёжнее.
  try {
    const { error } = await supabaseAdmin.from('channel_link_clicks').insert({
      code,
      user_agent: request.headers.get('user-agent') ?? null,
      referer: request.headers.get('referer') ?? null,
    })
    if (error) console.error('[channel-links] click log error:', error)
  } catch (e) {
    console.error('[channel-links] click log error:', e)
  }

  return NextResponse.redirect(link.destination_url, { status: 302 })
}
