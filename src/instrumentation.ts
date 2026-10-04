/**
 * Erros no servidor (página, ação ou rota que quebrou): grava em erros_app com a chave de serviço, para a administradora ver em
 * Administração → Mensagens. Sem a chave (ou sem a 0046), só fica no log do Vercel, como antes. Nunca deixa um erro daqui virar outro erro.
 */
export async function onRequestError(err: unknown, request: { path: string; method: string }, context: { routerKind: string; routeType: string }) {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || !process.env.SUPABASE_SERVICE_ROLE_KEY) return
  try {
    const e = err as { message?: string; digest?: string; stack?: string }
    const { ehErroDeControle } = await import('@/lib/engine/erros')
    if (ehErroDeControle(e?.digest ?? e?.message)) return // redirecionar e 404 não são erros
    const { supabaseAdmin } = await import('@/lib/supabase/admin')
    await supabaseAdmin().from('erros_app').insert({
      origem: 'servidor', mensagem: String(e?.message ?? err).slice(0, 1000), digest: e?.digest?.slice(0, 100) ?? null,
      pagina: `${request.method} ${request.path}`.slice(0, 300), detalhe: `${context.routeType}: ${(e?.stack ?? '').slice(0, 3800)}`, user_id: null,
    })
  } catch { /* o registro de erro nunca pode quebrar a resposta */ }
}
