import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { destinoDoDominio } from '@/lib/engine/dominio'

export async function middleware(req: NextRequest) {
  // endereço antigo (r1tmo.vercel.app) → endereço principal, antes de tudo (308 mantém o método e o corpo)
  const novo = destinoDoDominio(req.headers.get('host'), req.nextUrl.pathname, req.nextUrl.search, process.env.DOMINIO_PRINCIPAL)
  if (novo) return NextResponse.redirect(novo, 308)
  let res = NextResponse.next({ request: req })
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value))
        res = NextResponse.next({ request: req })
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
      },
    },
  })
  const { data: { user } } = await sb.auth.getUser()
  const onLogin = ['/login', '/cadastro'].some(p => req.nextUrl.pathname.startsWith(p)) // páginas públicas
  const publica = onLogin || ['/recuperar-senha', '/auth', '/api/cron', '/termos', '/privacidade'].some(p => req.nextUrl.pathname.startsWith(p))
  if (!user && !publica) return NextResponse.redirect(new URL('/login', req.url))
  if (user && onLogin) return NextResponse.redirect(new URL('/inicio', req.url))
  return res
}
export const config = { matcher: ['/((?!_next|_vercel|favicon.ico|manifest.webmanifest|icons/|sw.js|offline.html).*)'] }
