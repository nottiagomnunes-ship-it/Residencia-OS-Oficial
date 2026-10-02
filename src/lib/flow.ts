'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { hojeBR } from '@/lib/dates'
import { carregarGamificacao } from '@/lib/gamificacao-data'
import { generateReviews, nextDueAfterReview, addDays, diffDays, xpEstudo, xpRevisao } from '@/lib/engine/review'

async function ctx() {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  return { sb, uid: user.id }
}
const refresh = () => ['/inicio', '/conteudos', '/disciplinas', '/revisoes'].forEach(p => revalidatePath(p, 'layout'))

/**
 * Concluir conteúdo. As regras (datas das revisões, XP) são calculadas aqui; a gravação (sessão, status, revisões, calendário,
 * XP e estatísticas) é uma única transação no banco: ou grava tudo, ou nada. Repetir a conclusão não duplica nada.
 */
export async function concluirConteudo(fd: FormData) {
  const { sb, uid } = await ctx()
  const hoje = hojeBR(), min = Math.max(0, Number(fd.get('duration_min')) || 0)
  const { data: p } = await sb.from('profiles').select('review_intervals').eq('id', uid).single()
  const { error } = await sb.rpc('concluir_conteudo', {
    p_topic: String(fd.get('topic_id')), p_min: min, p_hoje: hoje, p_xp: xpEstudo(min), p_revisoes: generateReviews(hoje, p?.review_intervals ?? [1, 7, 30, 60]),
  })
  if (error) throw new Error('Não foi possível concluir o assunto. Nada foi alterado; tente de novo.')
  await carregarGamificacao(sb, hoje).catch(() => {})
  refresh()
}

/** Concluir revisão: o reajuste das próximas revisões é calculado aqui e gravado junto, na mesma transação. */
export async function concluirRevisao(fd: FormData) {
  const { sb, uid } = await ctx()
  const hoje = hojeBR(), id = String(fd.get('review_id'))
  const num = (k: string) => { const v = fd.get(k); return v === null || v === '' ? null : Number(v) }
  const desempenho = num('desempenho'), dificuldade = num('dificuldade'), tempo = num('tempo_min')
  const { data: r } = await sb.from('reviews').select('id,topic_id,numero,interval_days,status').eq('id', id).single()
  if (!r || r.status === 'concluida') return
  let ajustes: { id: string; due_date: string }[] = []
  const { data: p } = await sb.from('profiles').select('adaptive_reviews').eq('id', uid).single()
  if (p?.adaptive_reviews) {
    const { data: later } = await sb.from('reviews').select('id,interval_days,due_date').eq('topic_id', r.topic_id).eq('status', 'pendente').gt('numero', r.numero).order('numero')
    if (later?.length) {
      const delta = diffDays(later[0].due_date, nextDueAfterReview(hoje, r.interval_days, later[0].interval_days, desempenho, dificuldade))
      if (delta) ajustes = later.map(l => ({ id: l.id, due_date: addDays(l.due_date, delta) }))
    }
  }
  const { error } = await sb.rpc('concluir_revisao', {
    p_review: id, p_hoje: hoje, p_desempenho: desempenho, p_dificuldade: dificuldade, p_qtd: num('questoes_qtd'),
    p_obs: String(fd.get('observacoes') || '') || null, p_xp: xpRevisao(desempenho), p_ajustes: ajustes,
    ...(tempo && tempo > 0 ? { p_min: Math.round(tempo) } : {}), // tempo medido no cronômetro ou digitado; sem ele, vale o tempo planejado da tarefa
  })
  if (error) throw new Error('Não foi possível concluir a revisão. Nada foi alterado; tente de novo.')
  await carregarGamificacao(sb, hoje).catch(() => {})
  refresh()
}
