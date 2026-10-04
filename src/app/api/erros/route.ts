import { supabaseServer } from '@/lib/supabase/server'

/**
 * O navegador avisa um erro (tela "Algo deu errado"): grava em erros_app em nome da conta (sem sessão, ignora).
 * Nunca devolve erro para quem chamou: quem está com a tela quebrada não precisa de outra mensagem.
 */
export async function POST(req: Request) {
  try {
    const sb = await supabaseServer()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return new Response(null, { status: 204 })
    const b = await req.json().catch(() => ({})) as Record<string, unknown>
    const txt = (v: unknown, n: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null)
    const mensagem = txt(b.mensagem, 1000)
    if (mensagem) await sb.from('erros_app').insert({ origem: 'navegador', mensagem, digest: txt(b.digest, 100), pagina: txt(b.pagina, 300), detalhe: txt(b.detalhe, 4000),
      navegador: txt(req.headers.get('user-agent'), 300), user_id: user.id })
  } catch { /* nada */ }
  return new Response(null, { status: 204 })
}
