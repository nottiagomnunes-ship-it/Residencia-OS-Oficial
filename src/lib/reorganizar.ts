'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { hojeBR } from '@/lib/dates'

const ADIANTAVEIS = ['estudo', 'questoes', 'flashcards'] // revisões e simulados não são adiantados: o prazo da revisão importa e o simulado precisa de um bloco grande
const refresh = () => ['/inicio', '/cronograma', '/calendario', '/revisoes'].forEach(p => revalidatePath(p, 'layout'))

async function ctx() {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  return { sb, uid: user.id }
}

/** Puxa para hoje tarefas dos próximos dias (só estudo, questões e flashcards), no fim da lista de hoje. */
export async function adiantarTarefas(ids: string[]): Promise<{ movidas: number; erro?: string }> {
  const { sb } = await ctx(), hoje = hojeBR()
  const [{ data: itens }, { data: deHoje }] = await Promise.all([
    sb.from('schedule_items').select('id,data,ordem_dia').in('id', ids.slice(0, 20)).neq('status', 'concluido').gt('data', hoje).in('tipo', ADIANTAVEIS),
    sb.from('schedule_items').select('ordem_dia').eq('data', hoje).neq('status', 'concluido'),
  ])
  if (!itens?.length) return { movidas: 0 }
  const ordem = Math.max(0, ...(deHoje ?? []).map(x => x.ordem_dia ?? 0))
  const mov = [...itens].sort((a, b) => a.data.localeCompare(b.data) || (a.ordem_dia ?? 1e9) - (b.ordem_dia ?? 1e9)).map((x, k) => ({ id: x.id, data: hoje, ordem_dia: ordem + 1 + k }))
  const { data, error } = await sb.rpc('aplicar_movimentos', { p_mov: mov })
  if (error) return { movidas: 0, erro: 'Não foi possível adiantar. Nada foi alterado; tente de novo.' }
  refresh()
  return { movidas: (data as number) ?? mov.length }
}
