'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { hojeBR } from '@/lib/dates'
import { xpQuestoes } from '@/lib/engine/questoes'
import { carregarGamificacao } from '@/lib/gamificacao-data'
import { somarDia, resolverAlvo } from '@/lib/xp'

async function ctx() {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  return { sb, uid: user.id }
}
const refresh = () => ['/questoes', '/caderno-de-erros', '/inicio', '/desempenho', '/disciplinas', '/calendario', '/revisoes', '/conteudos'].forEach(p => revalidatePath(p, 'layout'))
const ISO = /^\d{4}-\d{2}-\d{2}$/
const opt = (fd: FormData, k: string) => String(fd.get(k) || '').trim() || null
const optN = (fd: FormData, k: string) => (fd.get(k) ? Number(fd.get(k)) : null)

export async function registrarQuestoes(fd: FormData) {
  const { sb, uid } = await ctx()
  const total = Number(fd.get('total')), acertos = Number(fd.get('acertos'))
  if (!Number.isInteger(total) || !Number.isInteger(acertos) || total < 1 || acertos < 0 || acertos > total)
    redirect('/questoes?erro=' + encodeURIComponent('Confira os números: o total deve ser maior que zero e os acertos não podem passar do total.'))
  const dia = ISO.test(String(fd.get('data'))) ? String(fd.get('data')) : hojeBR()
  const alvo = await resolverAlvo(sb, String(fd.get('alvo')))
  await sb.from('question_sets').insert({ user_id: uid, ...alvo, banca: opt(fd, 'banca'), prova: opt(fd, 'prova'), ano: optN(fd, 'ano'),
    total, acertos, tempo_min: optN(fd, 'tempo_min'), dificuldade: optN(fd, 'dificuldade'), realizado_em: dia })
  await somarDia(sb, uid, dia, { xp: xpQuestoes(total), questoes: total, acertos })
  // se havia um bloco de questões planejado para o dia e a meta foi atingida, ele é concluído
  const { data: blocos } = await sb.from('schedule_items').select('id,qtd_questoes').eq('tipo', 'questoes').eq('data', dia).neq('status', 'concluido')
  const b = blocos?.find(x => total >= (x.qtd_questoes ?? 0))
  if (b) await sb.from('schedule_items').update({ status: 'concluido' }).eq('id', b.id)
  if (alvo.topic_id) {
    const { data: et } = await sb.from('topic_tasks').select('id,qtd_questoes').eq('topic_id', alvo.topic_id).eq('tipo', 'questoes').eq('concluida', false).order('ordem')
    const e = et?.find(x => total >= (x.qtd_questoes ?? 0))
    if (e) await sb.from('topic_tasks').update({ concluida: true, concluida_em: new Date().toISOString() }).eq('id', e.id)
  }
  refresh()
  redirect(`/questoes?ok=${total}-${acertos}`)
}

export async function excluirQuestoes(fd: FormData) {
  const { sb, uid } = await ctx()
  const { data: q } = await sb.from('question_sets').select('id,total,acertos,realizado_em').eq('id', String(fd.get('id'))).single()
  if (!q) return
  await sb.from('question_sets').delete().eq('id', q.id)
  const { data: s } = await sb.from('daily_stats').select('minutos,questoes,acertos,xp').eq('user_id', uid).eq('data', q.realizado_em).maybeSingle()
  if (s) await sb.from('daily_stats').update({ questoes: Math.max(0, s.questoes - q.total), acertos: Math.max(0, s.acertos - q.acertos) }).eq('user_id', uid).eq('data', q.realizado_em)
  refresh()
}

export async function adicionarErro(fd: FormData) {
  const { sb, uid } = await ctx()
  const alvo = await resolverAlvo(sb, String(fd.get('alvo')))
  const rev = String(fd.get('revisar_em') || '')
  await sb.from('error_notebook').insert({ user_id: uid, ...alvo, enunciado: opt(fd, 'enunciado'), motivo: String(fd.get('motivo')),
    comentario: opt(fd, 'comentario'), revisar_em: ISO.test(rev) ? rev : null })
  await carregarGamificacao(sb, hojeBR()).catch(() => {})
  refresh()
}
export async function marcarRevisado(fd: FormData) {
  const { sb } = await ctx()
  await sb.from('error_notebook').update({ revisado: true }).eq('id', String(fd.get('id')))
  await carregarGamificacao(sb, hojeBR()).catch(() => {})
  refresh()
}
export async function excluirErro(fd: FormData) {
  const { sb } = await ctx()
  await sb.from('error_notebook').delete().eq('id', String(fd.get('id')))
  refresh()
}
