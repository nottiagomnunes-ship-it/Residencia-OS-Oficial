'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { hojeBR } from '@/lib/dates'
import { addDays, diffDays } from '@/lib/engine/review'
import { capacidadeDoDia } from '@/lib/engine/tempo'
import { DIAS_REVISOES, MSG_DESFAZER, fraseDoFim, moverRevisoes, separarAtrasadas, ultimaData, viabilidade, type Atrasada, type Modo } from '@/lib/engine/recalcular'
import { reorganizarAtrasadas, type ItemPlano } from '@/lib/engine/reorganizar'
import { calcularPlano } from '@/lib/plano-data'
import { planejarCronograma } from '@/lib/schedule'

const COLS = 'id,tipo,titulo,data,duracao_min,ordem_dia,origem,review_id,topic_id,topics(nome)'
const nomeDe = (x: any): string | undefined => { const t = x?.topics; return (Array.isArray(t) ? t[0]?.nome : t?.nome) ?? undefined }
const refresh = () => ['/inicio', '/cronograma', '/calendario', '/revisoes'].forEach(p => revalidatePath(p, 'layout'))

async function calcular() {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  const hoje = hojeBR(), fim = addDays(hoje, DIAS_REVISOES - 1)
  const [{ data: atr }, { data: abertos }, { data: caps }, { data: p }, { data: ult }, { data: feitos }] = await Promise.all([
    sb.from('schedule_items').select(COLS).lt('data', hoje).neq('status', 'concluido').order('data').limit(1000),
    sb.from('schedule_items').select('id,tipo,data,duracao_min,ordem_dia').gte('data', hoje).lte('data', fim).neq('status', 'concluido').limit(1000),
    sb.from('capacidade_dia').select('data,minutos').gte('data', hoje).lte('data', fim),
    sb.from('profiles').select('daily_minutes,available_weekdays,exam_date').eq('id', user.id).single(),
    sb.from('schedule_items').select('data').eq('tipo', 'estudo').eq('origem', 'auto').neq('status', 'concluido').order('data', { ascending: false }).limit(1),
    sb.from('schedule_items').select('duracao_min').eq('data', hoje).eq('status', 'concluido'),
  ])
  const todas = (atr ?? []) as unknown as Atrasada[], at = separarAtrasadas(todas)
  const informados = Object.fromEntries((caps ?? []).map(c => [c.data as string, c.minutos as number]))
  const padrao = p?.daily_minutes ?? 120, disponiveis = p?.available_weekdays ?? [1, 2, 3, 4, 5]
  const capacidade = (d: string) => capacidadeDoDia(d, informados, padrao, disponiveis).minutos
  const limite = p?.exam_date ?? null
  // rota equilibrada: só as revisões são movidas aqui (o resto o plano refeito resolve)
  const mov = moverRevisoes({ hoje, limite, revisoes: at.revisoes, futuras: ((abertos ?? []) as ItemPlano[]).filter(i => i.tipo === 'revisao'), capacidade })
  // rota leve: tudo o que está atrasado vai para o tempo que SOBRA nos próximos 21 dias; o resto do plano não se mexe
  const fimLeve = limite && limite < fim ? limite : fim
  const leve = reorganizarAtrasadas({
    hoje, dias: Math.max(1, diffDays(hoje, fimLeve) + 1), atrasadas: todas, abertos: (abertos ?? []) as ItemPlano[], capacidade,
    feitosHoje: (feitos ?? []).reduce((s, x) => s + (x.duracao_min ?? 30), 0),
  })
  const porId = new Map(at.revisoes.map(r => [r.id, r]))
  // a prévia do plano já conta as revisões no dia para onde vão (no banco elas ainda estão atrasadas)
  const extra = mov.movimentos.map(m => { const r = porId.get(m.id); return { data: m.para, duracao_min: m.duracao_min, topic_id: r?.topic_id ?? null, nome: nomeDe(r) } })
  return { sb, uid: user.id, at, total: todas.length, mov, leve, extra, fimAntes: (ult?.[0]?.data as string | undefined) ?? null }
}

export type PreviaRota =
  | { ok: false; msg: string }
  | {
    ok: true; viab: ReturnType<typeof viabilidade>; avisos: string[]
    equilibrada: { assuntos: number; revisoes: number; revisoesSemLugar: number; ateRevisoes: string | null; descartar: number; ficam: number; fim: string }
    leve: { total: number; movidas: number; semLugar: number; ate: string | null }
  }

/** Mostra o que cada rota faria, sem mudar nada. */
export async function previaRecalcular(): Promise<PreviaRota> {
  const { sb, uid, at, total, mov, leve, extra, fimAntes } = await calcular()
  const c = await calcularPlano(sb, uid, extra)
  if (!c.ok) return c
  const fimDepois = ultimaData(c.r.blocos.filter(b => b.tipo === 'estudo').map(b => b.data))
  return {
    ok: true, viab: viabilidade(c.r.minutosNecessarios, c.r.minutosFaltantes), avisos: c.r.avisos,
    equilibrada: {
      assuntos: at.assuntos, revisoes: mov.movimentos.length, revisoesSemLugar: mov.semLugar.length,
      ateRevisoes: ultimaData(mov.movimentos.map(m => m.para)), descartar: at.descartar.length, ficam: at.ficam.length, fim: fraseDoFim(fimAntes, fimDepois),
    },
    leve: { total, movidas: leve.movimentos.length, semLugar: leve.semLugar.length, ate: ultimaData(leve.movimentos.map(m => m.para)) },
  }
}

const semFuncao = (e: { code?: string; message?: string } | null) => !!e && (e.code === 'PGRST202' || e.code === '42883' || /function .* does not exist|Could not find the function/i.test(e.message ?? ''))

/**
 * Aplica a rota escolhida (recalcula na hora, para refletir o estado atual), guardando antes uma cópia do plano para desfazer.
 * Equilibrada: 1) revisões atrasadas para os próximos dias; 2) replaneja os assuntos a partir de hoje, como o "Gerar cronograma";
 * 3) apaga blocos de questões/simulado automáticos de dias que passaram. Leve: só encaixa as atrasadas no tempo que sobra.
 * Itens manuais atrasados ficam como estão na equilibrada.
 */
export async function recalcularRota(modo: Modo = 'equilibrada'): Promise<{ ok: boolean; msg: string; desfazer?: boolean }> {
  const { sb, at, mov, leve } = await calcular()
  if (modo === 'leve' && !leve.movimentos.length) return { ok: true, msg: 'Nada das atrasadas cabe no tempo que sobra nos próximos dias. Tente a rota equilibrada ou aumente o tempo em "Meu tempo".' }
  // sem a migração 0051 o recálculo funciona, só não pode ser desfeito
  const { error: errVersao } = await sb.rpc('salvar_versao_plano', { p_modo: modo })
  if (errVersao && !semFuncao(errVersao)) return { ok: false, msg: 'Não foi possível recalcular. Nada foi alterado; tente de novo.' }
  const desfazer = !errVersao

  if (modo === 'leve') {
    const { error } = await sb.rpc('aplicar_movimentos', { p_mov: leve.movimentos.map(m => ({ id: m.id, data: m.para, ordem_dia: m.ordem_dia })) })
    if (error) return { ok: false, msg: 'Não foi possível recalcular. Nada foi alterado; tente de novo.' }
    refresh()
    const n = leve.movimentos.length, r = leve.semLugar.length
    return { ok: true, desfazer, msg: `Rota leve aplicada: ${n} ${n === 1 ? 'tarefa encaixada' : 'tarefas encaixadas'} no tempo que sobra.${r ? ` ${r} ${r === 1 ? 'continua atrasada' : 'continuam atrasadas'}.` : ''}` }
  }

  if (mov.movimentos.length) {
    const { error } = await sb.rpc('aplicar_movimentos', { p_mov: mov.movimentos.map(m => ({ id: m.id, data: m.para, ordem_dia: m.ordem_dia })) })
    if (error) return { ok: false, msg: 'Não foi possível recalcular. Nada foi alterado; tente de novo.' }
  }
  const plano = await planejarCronograma()
  if (!plano.ok) return { ok: false, desfazer: desfazer && mov.movimentos.length > 0, msg: mov.movimentos.length ? `As revisões foram para os próximos dias, mas o plano não foi refeito: ${plano.msg}` : plano.msg }
  const ids = at.descartar.map(i => i.id)
  for (let i = 0; i < ids.length; i += 200) await sb.from('schedule_items').delete().in('id', ids.slice(i, i + 200)).eq('origem', 'auto').neq('status', 'concluido')
  refresh()
  return { ok: true, desfazer, msg: 'Rota recalculada. ' + plano.msg.replace(/^Cronograma atualizado: /, 'Plano refeito a partir de hoje: ') }
}

/** Volta o plano ao que era antes do último recálculo (até 7 dias, e só se nada do plano novo foi concluído). */
export async function desfazerRecalculo(): Promise<{ ok: boolean; msg: string }> {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  const { data, error } = await sb.rpc('desfazer_recalculo')
  if (error) return { ok: false, msg: 'Não foi possível desfazer. Nada foi alterado; tente de novo.' }
  if (data === 'ok') refresh()
  return { ok: data === 'ok', msg: MSG_DESFAZER[data as string] ?? MSG_DESFAZER.sem_versao }
}
