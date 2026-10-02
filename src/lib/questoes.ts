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
  const xp = xpQuestoes(total, acertos)
  const { error } = await sb.rpc('registrar_questoes', {
    p_disc: alvo.discipline_id, p_topic: alvo.topic_id, p_banca: opt(fd, 'banca'), p_prova: opt(fd, 'prova'), p_ano: optN(fd, 'ano'),
    p_total: total, p_acertos: acertos, p_tempo: optN(fd, 'tempo_min'), p_dif: optN(fd, 'dificuldade'), p_dia: dia, p_xp: xp,
  })
  if (error) redirect('/questoes?erro=' + encodeURIComponent('Não foi possível registrar as questões. Nada foi gravado; tente de novo.'))
  await carregarGamificacao(sb, hojeBR()).catch(() => {})
  refresh()
  redirect(`/questoes?ok=${total}-${acertos}&xp=${xp}`)
}

/** Exclui a sessão e devolve o XP, o tempo e as questões do dia, tudo numa transação. */
export async function excluirQuestoes(fd: FormData) {
  const { sb } = await ctx()
  await sb.rpc('excluir_questoes', { p_id: String(fd.get('id')) })
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
