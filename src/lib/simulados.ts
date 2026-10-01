'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { hojeBR } from '@/lib/dates'
import { xpSimulado } from '@/lib/engine/simulados'
import { somarDia } from '@/lib/xp'

async function ctx() {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  return { sb, uid: user.id }
}
const refresh = () => ['/simulados', '/questoes', '/desempenho', '/inicio', '/calendario', '/cronograma', '/metas'].forEach(p => revalidatePath(p, 'layout'))
const fail = (m: string) => redirect('/simulados?erro=' + encodeURIComponent(m))

/** Com nota por disciplina, o total e os acertos são somados dela; as questões alimentam o Desempenho. */
export async function registrarSimulado(fd: FormData) {
  const { sb, uid } = await ctx()
  const nome = String(fd.get('nome') || '').trim() || 'Simulado'
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(String(fd.get('data'))) ? String(fd.get('data')) : hojeBR()
  const tempo = fd.get('tempo_min') ? Number(fd.get('tempo_min')) : null
  const { data: ds } = await sb.from('disciplines').select('id,nome')
  const linhas = (ds ?? []).map(d => ({ discipline_id: d.id, nome: d.nome, total: Number(fd.get('q_' + d.id) || 0), acertos: Number(fd.get('a_' + d.id) || 0) })).filter(l => l.total > 0)
  if (linhas.some(l => !Number.isInteger(l.total) || !Number.isInteger(l.acertos) || l.acertos < 0 || l.acertos > l.total)) fail('Em alguma disciplina os acertos passam do total de questões.')
  const total = linhas.length ? linhas.reduce((s, l) => s + l.total, 0) : Number(fd.get('total'))
  const acertos = linhas.length ? linhas.reduce((s, l) => s + l.acertos, 0) : Number(fd.get('acertos'))
  if (!Number.isInteger(total) || !Number.isInteger(acertos) || total < 1 || acertos < 0 || acertos > total) fail('Confira os números: acertos não podem passar do total.')

  const { data: m } = await sb.from('mock_exams').insert({ user_id: uid, nome, data: dia, total, acertos, tempo_min: tempo, por_disciplina: linhas }).select('id').single()
  const base = { user_id: uid, banca: 'Simulado', prova: nome, realizado_em: dia, mock_exam_id: m!.id }
  await sb.from('question_sets').insert(linhas.length ? linhas.map(l => ({ ...base, discipline_id: l.discipline_id, total: l.total, acertos: l.acertos }))
    : [{ ...base, discipline_id: null, total, acertos, tempo_min: tempo }])
  await somarDia(sb, uid, dia, { xp: xpSimulado(total), minutos: tempo ?? 0, questoes: total, acertos })
  const { data: plan } = await sb.from('schedule_items').select('id').eq('tipo', 'simulado').eq('data', dia).neq('status', 'concluido').limit(1)
  if (plan?.[0]) await sb.from('schedule_items').update({ status: 'concluido' }).eq('id', plan[0].id)
  refresh()
  redirect(`/simulados?ok=${total}-${acertos}`)
}

export async function excluirSimulado(fd: FormData) {
  const { sb, uid } = await ctx()
  const { data: m } = await sb.from('mock_exams').select('id,data,total,acertos,tempo_min').eq('id', String(fd.get('id'))).single()
  if (!m) return
  await sb.from('mock_exams').delete().eq('id', m.id) // as questões ligadas saem junto (cascata)
  const { data: s } = await sb.from('daily_stats').select('minutos,questoes,acertos').eq('user_id', uid).eq('data', m.data).maybeSingle()
  if (s) await sb.from('daily_stats').update({ minutos: Math.max(0, s.minutos - (m.tempo_min ?? 0)), questoes: Math.max(0, s.questoes - m.total), acertos: Math.max(0, s.acertos - m.acertos) }).eq('user_id', uid).eq('data', m.data)
  refresh()
}
