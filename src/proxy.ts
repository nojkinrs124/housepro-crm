import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Пропускаем публичные пути
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Проверяем сессию (refreshes tokens если нужно)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Не авторизован — редирект на login
  if (!user) {
    const loginUrl = new URL('/login', request.url)
    // Сохраняем целевой URL для редиректа после входа
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Авторизован и идёт на / — редирект на dashboard
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Матчим все пути кроме:
     * - _next/static (статика)
     * - _next/image (оптимизация изображений)
     * - favicon.ico
     * - api/export/* (публичные XML-фиды Avito/CIAN)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/export).*)',
  ],
}
