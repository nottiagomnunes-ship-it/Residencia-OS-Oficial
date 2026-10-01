'use server'
import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { carregarGamificacao } from '@/lib/gamificacao-data'
import { hojeBR } from '@/lib/dates'
import { MODELO_PADRAO, TIPOS_ETAPA, validarEtapa, selecionarAssuntos, itensParaAdicionar, ultimoLote, podeDesfazer, type Etapa, type LinhaLote, type Modelo, type TopicoLote } from '@/lib/engine/etapas'

async function ctx() {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  return { sb, uid: user.id }
}
const refresh = () => ['/conteudos', '/disciplinas'].forEach(p => revalidatePath(p, 'layout'))
const COLS = 'id,tipo,titulo,qtd_questoes,concluida'

export async function adicionarEtapa(topicId: string, tipo: string, titulo: string, qtd: number | null): Promise<Etapa | null> {
  const { sb, uid } = await ctx()
  const t = titulo.trim().slice(0, 160)
  if (!(tipo in TIPOS_ETAPA) || !t) return null
  const q = tipo === 'questoes' && qtd && Number.isInteger(qtd) && qtd > 0 && qtd <= 1000 ? qtd : null
  const { count } = await sb.from('topic_tasks').select('id', { count: 'exact', head: true }).eq('topic_id', topicId)
  const { data } = await sb.from('topic_tasks').insert({ user_id: uid, topic_id: topicId, tipo, titulo: t, qtd_questoes: q, ordem: count ?? 0 }).select(COLS).single()
  refresh()
  return (data as Etapa) ?? null
}
/** Aplica o "conjunto padrão" (padrões marcados com ★); se o usuário não marcou nenhum, usa o trio original. */
export async function adicionarModelo(topicId: string): Promise<Etapa[]> {
  const { sb, uid } = await ctx()
  const { data: ms } = await sb.from('etapa_modelos').select('tipo,titulo,qtd_questoes').eq('conjunto', true).order('ordem').order('created_at')
  const base = ms?.length ? ms : MODELO_PADRAO
  const { count } = await sb.from('topic_tasks').select('id', { count: 'exact', head: true }).eq('topic_id', topicId)
  const { data } = await sb.from('topic_tasks').insert(base.map((m, i) => ({ tipo: m.tipo, titulo: m.titulo, qtd_questoes: m.qtd_questoes, user_id: uid, topic_id: topicId, ordem: (count ?? 0) + i }))).select(COLS)
  refresh()
  return (data as Etapa[]) ?? []
}
/** Adiciona ao assunto uma etapa a partir de um padrão salvo. */
export async function adicionarDoModelo(topicId: string, modeloId: string): Promise<Etapa | null> {
  const { sb, uid } = await ctx()
  const { data: m } = await sb.from('etapa_modelos').select('tipo,titulo,qtd_questoes').eq('id', modeloId).single()
  if (!m) return null
  const { count } = await sb.from('topic_tasks').select('id', { count: 'exact', head: true }).eq('topic_id', topicId)
  const { data } = await sb.from('topic_tasks').insert({ user_id: uid, topic_id: topicId, tipo: m.tipo, titulo: m.titulo, qtd_questoes: m.qtd_questoes, ordem: count ?? 0 }).select(COLS).single()
  refresh()
  return (data as Etapa) ?? null
}
/** Marcar a primeira etapa já coloca o assunto "em andamento". Concluir o assunto continua sendo um passo explícito. */
export async function alternarEtapa(id: string, feita: boolean) {
  const { sb } = await ctx()
  const { data: e } = await sb.from('topic_tasks').update({ concluida: feita, concluida_em: feita ? new Date().toISOString() : null }).eq('id', id).select('topic_id').single()
  if (e && feita) await sb.from('topics').update({ status: 'em_andamento' }).eq('id', e.topic_id).in('status', ['nao_iniciado', 'planejado'])
  if (feita) await carregarGamificacao(sb, hojeBR()).catch(() => {})
  refresh()
}
export async function excluirEtapa(id: string) {
  const { sb } = await ctx()
  await sb.from('topic_tasks').delete().eq('id', id)
  refresh()
}

/** Altera o texto (e, em etapas de questões, o número) de uma etapa já criada. */
export async function renomearEtapa(id: string, titulo: string, qtd: number | null): Promise<{ erro?: string }> {
  const { sb } = await ctx()
  const { data: e } = await sb.from('topic_tasks').select('tipo').eq('id', id).single()
  if (!e) return { erro: 'Etapa não encontrada.' }
  const v = validarEtapa(e.tipo, titulo, qtd)
  if ('erro' in v) return { erro: v.erro }
  await sb.from('topic_tasks').update({ titulo: v.titulo, lote_id: null, ...(e.tipo === 'questoes' ? { qtd_questoes: v.qtd } : {}) }).eq('id', id)
  refresh()
  return {}
}
/** Guarda um item escrito à mão como padrão reutilizável. */
export async function salvarPadrao(tipo: string, titulo: string, qtd: number | null, conjunto: boolean): Promise<Modelo | null> {
  const { sb, uid } = await ctx()
  const v = validarEtapa(tipo, titulo, qtd)
  if ('erro' in v) return null
  const { count } = await sb.from('etapa_modelos').select('id', { count: 'exact', head: true })
  const { data } = await sb.from('etapa_modelos').insert({ user_id: uid, tipo: v.tipo, titulo: v.titulo, qtd_questoes: v.qtd, conjunto, ordem: count ?? 0 }).select('id,tipo,titulo,qtd_questoes,conjunto').single()
  refresh()
  return (data as Modelo) ?? null
}
export async function excluirPadrao(id: string) {
  const { sb } = await ctx()
  await sb.from('etapa_modelos').delete().eq('id', id)
  refresh()
}
export async function alternarConjunto(id: string, valor: boolean) {
  const { sb } = await ctx()
  await sb.from('etapa_modelos').update({ conjunto: valor }).eq('id', id)
  refresh()
}

const partes = <T,>(a: T[], n = 500) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n))

/** Aplica o conjunto padrão (ou um padrão só) a vários assuntos. O servidor recalcula quem é atingido; nunca duplica uma etapa já existente. */
export async function aplicarEmLote(escopo: string, modeloId: string, pular: boolean): Promise<{ assuntos: number; etapas: number; erro?: string }> {
  const { sb, uid } = await ctx()
  const [{ data: ts }, { data: et }, { data: ms }] = await Promise.all([
    sb.from('topics').select('id,status,grupo,discipline_id'),
    sb.from('topic_tasks').select('topic_id,tipo,titulo').limit(50000),
    sb.from('etapa_modelos').select('id,tipo,titulo,qtd_questoes,conjunto').order('ordem').order('created_at'),
  ])
  const conj = (ms ?? []).filter(m => m.conjunto)
  const itens = modeloId === 'conjunto' ? (conj.length ? conj : MODELO_PADRAO) : (ms ?? []).filter(m => m.id === modeloId)
  if (!itens.length) return { assuntos: 0, etapas: 0, erro: 'Escolha um padrão que ainda exista.' }
  const existentes = new Map<string, { tipo: string; titulo: string }[]>()
  for (const x of et ?? []) existentes.set(x.topic_id, [...(existentes.get(x.topic_id) ?? []), { tipo: x.tipo, titulo: x.titulo }])
  const contagem = Object.fromEntries([...existentes].map(([k, v]) => [k, v.length]))
  const ids = selecionarAssuntos((ts ?? []) as TopicoLote[], contagem, escopo, pular)
  if (ids.length > 2000) return { assuntos: 0, etapas: 0, erro: 'Limite de 2.000 assuntos por vez. Escolha um escopo menor.' }
  const lote = randomUUID() // marca as etapas deste lote, para poder desfazer
  const linhas = ids.flatMap(id => {
    const ja = existentes.get(id) ?? []
    return itensParaAdicionar(itens, ja).map((m, i) => ({ user_id: uid, topic_id: id, tipo: m.tipo, titulo: m.titulo, qtd_questoes: m.qtd_questoes, ordem: ja.length + i, lote_id: lote }))
  })
  for (const c of partes(linhas)) await sb.from('topic_tasks').insert(c)
  refresh()
  return { assuntos: new Set(linhas.map(l => l.topic_id)).size, etapas: linhas.length }
}

/** Remove as etapas do último lote que ainda não foram concluídas nem editadas; as concluídas ficam e deixam de ser "desfazíveis". */
export async function desfazerUltimoLote(): Promise<{ removidas: number; mantidas: number; erro?: string }> {
  const { sb } = await ctx()
  const { data: rows } = await sb.from('topic_tasks').select('lote_id,created_at,concluida,topic_id').not('lote_id', 'is', null).order('created_at', { ascending: false }).limit(5000)
  const ult = ultimoLote((rows ?? []) as LinhaLote[])
  if (!ult) return { removidas: 0, mantidas: 0, erro: 'Não há nenhum lote para desfazer.' }
  if (!podeDesfazer(ult.em)) return { removidas: 0, mantidas: 0, erro: 'O último lote foi aplicado há mais de 24 horas e não pode mais ser desfeito.' }
  const { data: del } = await sb.from('topic_tasks').delete().eq('lote_id', ult.id).eq('concluida', false).select('id')
  await sb.from('topic_tasks').update({ lote_id: null }).eq('lote_id', ult.id)
  refresh()
  return { removidas: del?.length ?? 0, mantidas: ult.concluidas }
}
