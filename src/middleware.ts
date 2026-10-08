import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { destinoDoDominio } from '@/lib/engine/dominio'
import { destinoDoLogin } from '@/lib/engine/rotas'

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
  const destino = destinoDoLogin(req.nextUrl.pathname, !!user) // páginas públicas e quem já entrou: src/lib/engine/rotas.ts
  if (destino) return NextResponse.redirect(new URL(destino, req.url))
  return res
}
export const config = { matcher: ['/((?!_next|_vercel|favicon.ico|manifest.webmanifest|icons/|sw.js|offline.html|opengraph-image|twitter-image).*)'] }
