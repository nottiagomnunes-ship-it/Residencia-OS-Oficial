'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { hojeBR } from '@/lib/dates'
import { somarDia } from '@/lib/xp'
import { generateReviews, nextDueAfterReview, addDays, diffDays, xpEstudo, xpRevisao } from '@/lib/engine/review'

async function ctx() {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  return { sb, uid: user.id }
}
const refresh = () => ['/inicio', '/conteudos', '/disciplinas', '/revisoes'].forEach(p => revalidatePath(p, 'layout'))

const addXp = (sb: Awaited<ReturnType<typeof ctx>>['sb'], uid: string, hoje: string, xp: number, minutos: number) => somarDia(sb, uid, hoje, { xp, minutos })

/** Concluir conteúdo: sessão + status + revisões + calendário + XP + estatísticas do dia. */
export async function concluirConteudo(fd: FormData) {
  const { sb, uid } = await ctx()
  const hoje = hojeBR(), min = Math.max(0, Number(fd.get('duration_min')) || 0)
  const { data: t } = await sb.from('topics').select('id,nome,status').eq('id', String(fd.get('topic_id'))).single()
  if (!t || t.status === 'concluido') return
  const { data: p } = await sb.from('profiles').select('review_intervals').eq('id', uid).single()
  const { data: ses } = await sb.from('study_sessions').insert({ user_id: uid, topic_id: t.id, duration_min: min }).select('id').single()
  await sb.from('topics').update({ status: 'concluido', completed_date: hoje }).eq('id', t.id)
  await sb.from('schedule_items').update({ status: 'concluido' }).eq('topic_id', t.id).eq('tipo', 'estudo')
  const rows = generateReviews(hoje, p?.review_intervals ?? [1, 7, 30, 60]).map(r => ({ ...r, user_id: uid, topic_id: t.id, origem_session_id: ses?.id }))
  const { data: created } = await sb.from('reviews').insert(rows).select('id,interval_days,due_date')
  await sb.from('schedule_items').insert((created ?? []).map(r => ({
    user_id: uid, tipo: 'revisao', topic_id: t.id, review_id: r.id, titulo: `Revisão D${r.interval_days} — ${t.nome}`, data: r.due_date, duracao_min: 30,
  })))
  await addXp(sb, uid, hoje, xpEstudo(min), min)
  refresh()
}

/** Concluir revisão: registra desempenho e, se ativado, reajusta as próximas revisões do assunto. */
export async function concluirRevisao(fd: FormData) {
  const { sb, uid } = await ctx()
  const hoje = hojeBR(), id = String(fd.get('review_id'))
  const num = (k: string) => { const v = fd.get(k); return v === null || v === '' ? null : Number(v) }
  const desempenho = num('desempenho'), dificuldade = num('dificuldade')
  const { data: r } = await sb.from('reviews').select('id,topic_id,numero,interval_days,status').eq('id', id).single()
  if (!r || r.status === 'concluida') return
  await sb.from('reviews').update({
    status: 'concluida', completed_at: new Date().toISOString(), desempenho, dificuldade,
    questoes_qtd: num('questoes_qtd'), observacoes: String(fd.get('observacoes') || '') || null,
  }).eq('id', id)
  await sb.from('schedule_items').update({ status: 'concluido' }).eq('review_id', id)
  const { data: p } = await sb.from('profiles').select('adaptive_reviews').eq('id', uid).single()
  if (p?.adaptive_reviews) {
    const { data: later } = await sb.from('reviews').select('id,interval_days,due_date').eq('topic_id', r.topic_id).eq('status', 'pendente').gt('numero', r.numero).order('numero')
    if (later?.length) {
      const delta = diffDays(later[0].due_date, nextDueAfterReview(hoje, r.interval_days, later[0].interval_days, desempenho, dificuldade))
      if (delta) for (const l of later) {
        const d = addDays(l.due_date, delta)
        await sb.from('reviews').update({ due_date: d }).eq('id', l.id)
        await sb.from('schedule_items').update({ data: d }).eq('review_id', l.id)
      }
    }
  }
  await addXp(sb, uid, hoje, xpRevisao(desempenho), 0)
  refresh()
}
