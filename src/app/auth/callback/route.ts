import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PKCE callback — Supabase email-ссылки (сброс пароля, приглашения, magic link)
// ведут сюда с ?code=..., обмениваем на сессию и редиректим на next.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
