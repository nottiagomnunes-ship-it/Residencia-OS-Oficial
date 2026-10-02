'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { hojeBR } from '@/lib/dates'
import { addDays, xpEstudo } from '@/lib/engine/review'
import { validarEdicaoTarefa, type EdicaoCampos } from '@/lib/engine/calendar'
import { concluirConteudo, concluirRevisao } from '@/lib/flow'
import { conflitosComOcupados, descreverConflitos, hhmmParaMin, ocupadosPorData, paraCompromisso, type Intervalo } from '@/lib/engine/compromissos'

async function ctx() {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  return { sb, uid: user.id }
}
const refresh = () => ['/calendario', '/inicio', '/revisoes', '/conteudos', '/disciplinas'].forEach(p => revalidatePath(p, 'layout'))
const ISO = /^\d{4}-\d{2}-\d{2}$/
const COLS = 'id,tipo,status,data,review_id,topic_id,duracao_min,hora_ini,hora_fim'

async function reagendar(sb: Awaited<ReturnType<typeof ctx>>['sb'], i: any, data: string) {
  await sb.from('schedule_items').update({ data, status: 'agendado' }).eq('id', i.id)
  if (i.review_id) await sb.from('reviews').update({ due_date: data }).eq('id', i.review_id)
  else if (i.tipo === 'estudo' && i.topic_id) await sb.from('topics').update({ planned_date: data, planned_auto: false }).eq('id', i.topic_id)
}

type SB = Awaited<ReturnType<typeof ctx>>['sb']
/** Conflito do horário com compromissos (Minha semana) e com outras tarefas do dia que tenham horário. Itens sem horário não conflitam. */
async function conflitoEm(sb: SB, data: string, horaIni: string | null, horaFim: string | null, dur: number | null, ignorarId?: string) {
  if (!horaIni) return null
  const ini = hhmmParaMin(horaIni), fim = horaFim ? hhmmParaMin(horaFim) : ini + (dur ?? 30)
  const [{ data: cm }, { data: outras }] = await Promise.all([
    sb.from('commitments').select('*'),
    sb.from('schedule_items').select('id,titulo,hora_ini,hora_fim,duracao_min').eq('data', data).neq('status', 'concluido').not('hora_ini', 'is', null),
  ])
  const oc: Intervalo[] = [
    ...(ocupadosPorData((cm ?? []).map(paraCompromisso), addDays(data, -1), data)[data] ?? []),
    ...(outras ?? []).filter(x => x.id !== ignorarId).map(x => {
      const a = hhmmParaMin(x.hora_ini), f = x.hora_fim ? hhmmParaMin(x.hora_fim) : a + (x.duracao_min ?? 30)
      return { ini: a, fim: f > a ? f : 1440, titulo: x.titulo as string, tarefa: true }
    }),
  ]
  return descreverConflitos(conflitosComOcupados(ini, fim > ini ? fim : 1440, oc))
}

/** Sem `forcar`, devolve o conflito (se houver) em vez de mover; o cliente pergunta e repete com forcar = true. */
export async function moverItem(id: string, data: string, forcar = false): Promise<{ conflito?: string }> {
  const { sb } = await ctx()
  const { data: i } = await sb.from('schedule_items').select(COLS).eq('id', id).single()
  if (!i || i.status === 'concluido' || !ISO.test(data)) return {}
  if (!forcar) { const c = await conflitoEm(sb, data, i.hora_ini, i.hora_fim, i.duracao_min, id); if (c) return { conflito: c } }
  await reagendar(sb, i, data); refresh()
  return {}
}
export async function adiarItem(id: string, forcar = false): Promise<{ conflito?: string }> {
  const { sb } = await ctx()
  const { data: i } = await sb.from('schedule_items').select(COLS).eq('id', id).single()
  if (!i || i.status === 'concluido') return {}
  const base = i.data > hojeBR() ? i.data : hojeBR(), novo = addDays(base, 1)
  if (!forcar) { const c = await conflitoEm(sb, novo, i.hora_ini, i.hora_fim, i.duracao_min, id); if (c) return { conflito: c } }
  await reagendar(sb, i, novo); refresh()
  return {}
}
/** Concluir usa o mesmo fluxo de Revisões/Conteúdos, então gera revisões, XP e estatísticas. */
export async function concluirItem(id: string) {
  const { sb } = await ctx()
  const { data: i } = await sb.from('schedule_items').select(COLS).eq('id', id).single()
  if (!i || i.status === 'concluido') return
  const f = new FormData()
  if (i.review_id) { f.set('review_id', i.review_id); await concluirRevisao(f) }
  else if (i.tipo === 'estudo' && i.topic_id) { f.set('topic_id', i.topic_id); f.set('duration_min', String(i.duracao_min ?? 60)); await concluirConteudo(f) }
  else if (i.tipo === 'estudo') { // estudo sem assunto (reforço ou tarefa manual): conta como sessão de estudo
    const min = i.duracao_min ?? 60
    const { error } = await sb.rpc('registrar_dia', { p_dia: hojeBR(), p_xp: xpEstudo(min), p_min: min, p_q: 0, p_ac: 0 })
    if (!error) await sb.from('schedule_items').update({ status: 'concluido' }).eq('id', id)
  }
  else await sb.from('schedule_items').update({ status: 'concluido' }).eq('id', id) // flashcards e afins (questões e simulados passam pelo registro)
  refresh()
}
/** Excluir uma revisão automática remove a própria revisão (o item some junto, por cascata). */
export async function excluirItem(id: string) {
  const { sb } = await ctx()
  const { data: i } = await sb.from('schedule_items').select('id,review_id').eq('id', id).single()
  if (!i) return
  if (i.review_id) await sb.from('reviews').delete().eq('id', i.review_id)
  else await sb.from('schedule_items').delete().eq('id', id)
  refresh()
}
export async function criarItem(fd: FormData): Promise<{ ok: boolean; conflito?: string }> {
  const { sb, uid } = await ctx()
  const data = String(fd.get('data'))
  if (!ISO.test(data)) return { ok: false }
  const n = (k: string) => (fd.get(k) ? Number(fd.get(k)) : null)
  const ini = String(fd.get('hora_ini') || '') || null, dur = n('duracao_min')
  const fim = ini && dur ? new Date(Date.UTC(2000, 0, 1, +ini.slice(0, 2), +ini.slice(3, 5) + dur)).toISOString().slice(11, 16) : null
  if (fd.get('forcar') !== '1') { const c = await conflitoEm(sb, data, ini, fim, dur); if (c) return { ok: false, conflito: c } }
  await sb.from('schedule_items').insert({ user_id: uid, tipo: String(fd.get('tipo')), titulo: String(fd.get('titulo')).trim(), data,
    hora_ini: ini, hora_fim: fim, duracao_min: dur, qtd_questoes: n('qtd_questoes'), origem: 'manual' })
  refresh()
  return { ok: true }
}

/** Edita título, horário, duração e nº de questões. A data muda em "Mover". Com conflito de horário, devolve o aviso para o cliente confirmar. */
export async function editarItem(id: string, c: EdicaoCampos, forcar = false): Promise<{ conflito?: string; erro?: string }> {
  const { sb } = await ctx()
  const { data: i } = await sb.from('schedule_items').select(COLS).eq('id', id).single()
  if (!i || i.status === 'concluido') return { erro: 'Esta tarefa não pode mais ser editada.' }
  const v = validarEdicaoTarefa(c, !!i.review_id)
  if ('erro' in v) return { erro: v.erro }
  if (!forcar) { const x = await conflitoEm(sb, i.data, v.hora_ini, v.hora_fim, v.dur, id); if (x) return { conflito: x } }
  await sb.from('schedule_items').update({
    ...(i.review_id ? {} : { titulo: v.titulo }), hora_ini: v.hora_ini, hora_fim: v.hora_fim, duracao_min: v.dur,
    ...(i.tipo === 'questoes' ? { qtd_questoes: v.qtd } : {}),
  }).eq('id', id)
  refresh()
  return {}
}
