import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { supabaseServer } from '@/lib/supabase/server'
import { caminhoSeguro, mensagemGoogle } from '@/lib/engine/auth'

const TIPOS: EmailOtpType[] = ['recovery', 'signup', 'email']

/**
 * Valida o link enviado por e-mail (token_hash, que funciona em qualquer aparelho, ou code) e leva para a página certa.
 * Também é a volta do "Entrar com o Google" (via=google): se der errado, volta para a entrada com a mensagem.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const tokenHash = q.get('token_hash'), tipo = q.get('type') as EmailOtpType | null, code = q.get('code')
  const sb = await supabaseServer()
  let ok = false
  if (tokenHash && tipo && TIPOS.includes(tipo)) ok = !(await sb.auth.verifyOtp({ type: tipo, token_hash: tokenHash })).error
  else if (code) ok = !(await sb.auth.exchangeCodeForSession(code)).error
  const url = req.nextUrl.clone()
  url.search = ''
  if (!ok && q.get('via') === 'google') { url.pathname = '/login'; url.search = `?erro=${encodeURIComponent(mensagemGoogle(q.get('error')))}`; return NextResponse.redirect(url) }
  if (ok) url.pathname = caminhoSeguro(q.get('next'), '/inicio')
  else { url.pathname = '/recuperar-senha'; url.search = '?erro=link' }
  return NextResponse.redirect(url)
}
