'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { hojeBR } from '@/lib/dates'
import { xpEstudo } from '@/lib/engine/review'
import { concluirConteudo, concluirRevisao } from '@/lib/flow'
import { LIMITE_MAX_MIN, type Cron, type TipoCron } from '@/lib/engine/cronometro'
import { COLS_CRON } from '@/lib/cronometro-data'

const TIPOS_DE_TAREFA = ['estudo', 'revisao', 'questoes', 'simulado', 'flashcards']
const refresh = () => ['/inicio', '/calendario', '/cronograma', '/revisoes', '/desempenho'].forEach(p => revalidatePath(p, 'layout'))

async function ctx() {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  return { sb }
}

/** Inicia um cronômetro para uma tarefa (ou livre, sem tarefa). Só pode haver um: se já existe, devolve o título dele. */
export async function iniciarCronometro(itemId: string | null, tituloLivre = 'Estudo livre'): Promise<{ cron?: Cron; erro?: 'ativo' | 'falha'; ativo?: string }> {
  const { sb } = await ctx()
  let a: { tipo: TipoCron; titulo: string; topic: string | null; review: string | null; plan: number | null; qtd: number | null; item: string | null } =
    { tipo: 'livre', titulo: tituloLivre.trim().slice(0, 160) || 'Estudo livre', topic: null, review: null, plan: null, qtd: null, item: null }
  if (itemId) {
    const { data: i } = await sb.from('schedule_items').select('id,tipo,titulo,topic_id,review_id,duracao_min,qtd_questoes,status').eq('id', itemId).maybeSingle()
    if (!i || i.status === 'concluido') return { erro: 'falha' }
    a = { tipo: (TIPOS_DE_TAREFA.includes(i.tipo) ? i.tipo : 'estudo') as TipoCron, titulo: i.titulo, topic: i.topic_id, review: i.review_id, plan: i.duracao_min, qtd: i.qtd_questoes, item: i.id }
  }
  const { data, error } = await sb.rpc('iniciar_cronometro', { p_item: a.item, p_tipo: a.tipo, p_titulo: a.titulo, p_topic: a.topic, p_review: a.review, p_planejado: a.plan, p_qtd: a.qtd })
  if (error) return { erro: 'falha' }
  const novo = (Array.isArray(data) ? data[0] : data) as Cron | undefined
  if (novo?.id) return { cron: novo }
  const { data: atual } = await sb.from('cronometros').select('titulo').maybeSingle()
  return { erro: 'ativo', ativo: atual?.titulo }
}

async function mudar(fn: 'pausar_cronometro' | 'retomar_cronometro'): Promise<{ cron?: Cron; erro?: boolean }> {
  const { sb } = await ctx()
  const { data, error } = await sb.rpc(fn)
  if (error) return { erro: true }
  const c = (Array.isArray(data) ? data[0] : data) as Cron | undefined
  return c?.id ? { cron: c } : { erro: true }
}
export const pausarCronometro = async () => mudar('pausar_cronometro')
export const retomarCronometro = async () => mudar('retomar_cronometro')

/** Descarta o cronômetro sem registrar nada (também usado quando o registro segue por outro formulário, que já recebe o tempo). */
export async function descartarCronometro(): Promise<{ ok: boolean }> {
  const { sb } = await ctx()
  const { error } = await sb.from('cronometros').delete().not('id', 'is', null)
  return { ok: !error }
}

/**
 * Finaliza com os minutos confirmados pela pessoa. 'concluir' conclui a tarefa pelo MESMO caminho de sempre (assunto, revisão),
 * só que com o tempo medido; 'tempo' só soma às horas estudadas. Se algo falhar, o cronômetro é mantido para tentar de novo.
 * Se o assunto/a revisão já estavam concluídos, só o tempo é registrado (para não perdê-lo).
 */
export async function finalizarCronometro(modo: 'concluir' | 'tempo', minutos: number): Promise<{ ok: boolean; erro?: string; aviso?: string }> {
  const { sb } = await ctx()
  const { data: c } = await sb.from('cronometros').select(COLS_CRON).maybeSingle()
  if (!c) return { ok: false, erro: 'Não há cronômetro em andamento.' }
  if (!Number.isInteger(minutos) || minutos < 1 || minutos > LIMITE_MAX_MIN) return { ok: false, erro: `Informe de 1 a ${LIMITE_MAX_MIN} minutos.` }
  if (modo === 'concluir' && (c.tipo === 'questoes' || c.tipo === 'simulado')) return { ok: false, erro: 'Questões e simulado se concluem pelo registro, onde está o resultado.' }
  const hoje = hojeBR()
  const soTempo = async () => { const { error } = await sb.rpc('registrar_dia', { p_dia: hoje, p_xp: 0, p_min: minutos, p_q: 0, p_ac: 0 }); if (error) throw new Error('tempo') }
  let aviso: string | undefined
  try {
    if (modo === 'tempo' || c.tipo === 'livre' || c.tipo === 'questoes' || c.tipo === 'simulado') {
      await soTempo()
    } else if (c.tipo === 'estudo' && c.topic_id) {
      const { data: t } = await sb.from('topics').select('status').eq('id', c.topic_id).maybeSingle()
      if (!t || t.status === 'concluido') { await soTempo(); aviso = 'O assunto já estava concluído: registrei só o tempo.' }
      else { const f = new FormData(); f.set('topic_id', c.topic_id); f.set('duration_min', String(minutos)); await concluirConteudo(f) }
    } else if (c.tipo === 'estudo') { // reforço ou tarefa manual, sem assunto
      const { error } = await sb.rpc('registrar_dia', { p_dia: hoje, p_xp: xpEstudo(minutos), p_min: minutos, p_q: 0, p_ac: 0 })
      if (error) throw new Error('estudo')
      if (c.item_id) await sb.from('schedule_items').update({ status: 'concluido' }).eq('id', c.item_id)
    } else if (c.tipo === 'revisao') {
      const { data: r } = c.review_id ? await sb.from('reviews').select('status').eq('id', c.review_id).maybeSingle() : { data: null }
      if (!r || r.status === 'concluida') { await soTempo(); aviso = 'A revisão já estava concluída: registrei só o tempo.' }
      else { const f = new FormData(); f.set('review_id', c.review_id as string); f.set('tempo_min', String(minutos)); await concluirRevisao(f) }
    } else { // flashcards
      await soTempo()
      if (c.item_id) await sb.from('schedule_items').update({ status: 'concluido' }).eq('id', c.item_id)
    }
  } catch {
    return { ok: false, erro: 'Não foi possível finalizar. O cronômetro foi mantido; tente de novo.' }
  }
  await sb.from('cronometros').delete().eq('id', c.id)
  refresh()
  return { ok: true, aviso }
}
