import { supabaseServer } from '@/lib/supabase/server'
import { ehAdmin, carregarTemas } from '@/lib/banco-data'
import { listaDeTemasEmTexto } from '@/lib/engine/temas'
import { hojeBR } from '@/lib/dates'

/** Baixa a Lista de temas em texto (para mandar ao Claude junto com uma prova). Só a conta administradora. */
export async function GET() {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return new Response('Entre na sua conta.', { status: 401 })
  if (!(await ehAdmin(sb))) return new Response('Só a conta administradora baixa a lista de temas.', { status: 403 })
  const temas = await carregarTemas(sb)
  return new Response(listaDeTemasEmTexto(temas) + '\n', { headers: {
    'content-type': 'text/plain; charset=utf-8', 'content-disposition': `attachment; filename="temas-${hojeBR()}-${temas.length}.txt"`, 'cache-control': 'no-store',
  } })
}
