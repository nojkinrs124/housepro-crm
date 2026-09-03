import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PREFIXES = [
  '/login',
  '/forgot-password',
  '/reset-password',
  '/auth/callback',
  '/api/public',
  '/api/onboarding',
  '/api/billing',
  '/api/stripe',
  '/c/',
  '/r/', // редирект-сервис для CTA-ссылок Telegram-канала — публичный, без авторизации
  // ── Публичный маркетинговый сайт «ХаусПро» (src/app/(site)) ──
  '/catalog',
  '/uslugi',
  '/o-kompanii',
  '/kontakty',
  '/policy', // политика обработки ПДн — на неё ссылается форма заявки для неавторизованных
  '/sign/', // подписание договора клиентом по персональной ссылке — учётки в CRM у него нет
  // ── Личные кабинеты собственника и арендатора (src/app/(portal)) ──
  // У них свой контур доступа: они не сотрудники организации, учётки Supabase
  // Auth у них нет, и проверка ниже отправила бы их на /login навсегда. Право
  // видеть данные проверяет features/portal/services/access.service.ts на
  // КАЖДОМ запросе — по строке portal_access, а не по этому списку.
  '/cabinet',
]

/**
 * Пути, которые публичны ТОЛЬКО при точном совпадении.
 *
 * Главная страница сайта живёт на '/', и её нельзя добавлять в PUBLIC_PREFIXES:
 * там проверка через startsWith(), а startsWith('/') истинно для АБСОЛЮТНО
 * любого пути — это мгновенно сняло бы авторизацию со всей CRM.
 */
const PUBLIC_EXACT = new Set([
  '/',
  '/sitemap.xml',
  '/robots.txt',
])

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
}
