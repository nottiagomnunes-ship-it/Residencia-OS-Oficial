'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { hojeBR } from '@/lib/dates'
import { addDays } from '@/lib/engine/review'
import { capacidadeDoDia } from '@/lib/engine/tempo'
import { DIAS_REVISOES, fraseDoFim, moverRevisoes, separarAtrasadas, ultimaData, type Atrasada } from '@/lib/engine/recalcular'
import type { ItemPlano } from '@/lib/engine/reorganizar'
import { calcularPlano } from '@/lib/plano-data'
import { planejarCronograma } from '@/lib/schedule'

const COLS = 'id,tipo,titulo,data,duracao_min,ordem_dia,origem,review_id,topic_id,topics(nome)'
const nomeDe = (x: any): string | undefined => { const t = x?.topics; return (Array.isArray(t) ? t[0]?.nome : t?.nome) ?? undefined }

async function calcular() {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  const hoje = hojeBR(), fim = addDays(hoje, DIAS_REVISOES - 1)
  const [{ data: atr }, { data: futuras }, { data: caps }, { data: p }, { data: ult }] = await Promise.all([
    sb.from('schedule_items').select(COLS).lt('data', hoje).neq('status', 'concluido').order('data').limit(1000),
    sb.from('schedule_items').select('id,tipo,data,duracao_min,ordem_dia').eq('tipo', 'revisao').gte('data', hoje).lte('data', fim).neq('status', 'concluido').limit(1000),
    sb.from('capacidade_dia').select('data,minutos').gte('data', hoje).lte('data', fim),
    sb.from('profiles').select('daily_minutes,available_weekdays,exam_date').eq('id', user.id).single(),
    sb.from('schedule_items').select('data').eq('tipo', 'estudo').eq('origem', 'auto').neq('status', 'concluido').order('data', { ascending: false }).limit(1),
  ])
  const at = separarAtrasadas((atr ?? []) as unknown as Atrasada[])
  const informados = Object.fromEntries((caps ?? []).map(c => [c.data as string, c.minutos as number]))
  const padrao = p?.daily_minutes ?? 120, disponiveis = p?.available_weekdays ?? [1, 2, 3, 4, 5]
  const mov = moverRevisoes({
    hoje, limite: p?.exam_date ?? null, revisoes: at.revisoes, futuras: (futuras ?? []) as ItemPlano[],
    capacidade: d => capacidadeDoDia(d, informados, padrao, disponiveis).minutos,
  })
  const porId = new Map(at.revisoes.map(r => [r.id, r]))
  // a prévia do plano já conta as revisões no dia para onde vão (no banco elas ainda estão atrasadas)
  const extra = mov.movimentos.map(m => { const r = porId.get(m.id); return { data: m.para, duracao_min: m.duracao_min, topic_id: r?.topic_id ?? null, nome: nomeDe(r) } })
  return { sb, uid: user.id, hoje, at, mov, extra, fimAntes: (ult?.[0]?.data as string | undefined) ?? null }
}

export type PreviaRota =
  | { ok: false; msg: string }
  | { ok: true; assuntos: number; revisoes: number; revisoesSemLugar: number; ateRevisoes: string | null; descartar: number; ficam: number; fim: string; avisos: string[] }

/** Mostra o que o "Recalcular rota" faria, sem mudar nada. */
export async function previaRecalcular(): Promise<PreviaRota> {
  const { sb, uid, at, mov, extra, fimAntes } = await calcular()
  const c = await calcularPlano(sb, uid, extra)
  if (!c.ok) return c
  const fimDepois = ultimaData(c.r.blocos.filter(b => b.tipo === 'estudo').map(b => b.data))
  return {
    ok: true, assuntos: at.assuntos, revisoes: mov.movimentos.length, revisoesSemLugar: mov.semLugar.length,
    ateRevisoes: ultimaData(mov.movimentos.map(m => m.para)), descartar: at.descartar.length, ficam: at.ficam.length,
    fim: fraseDoFim(fimAntes, fimDepois), avisos: c.r.avisos,
  }
}

/**
 * Aplica (recalcula na hora, para refletir o estado atual): 1) revisões atrasadas para os próximos dias; 2) replaneja os assuntos
 * a partir de hoje, como o "Gerar cronograma" (o estudo atrasado sai e volta no lugar novo); 3) apaga blocos de questões/simulado
 * automáticos de dias que já passaram. Itens manuais atrasados ficam como estão.
 */
export async function recalcularRota(): Promise<{ ok: boolean; msg: string }> {
  const { sb, at, mov } = await calcular()
  if (mov.movimentos.length) {
    const { error } = await sb.rpc('aplicar_movimentos', { p_mov: mov.movimentos.map(m => ({ id: m.id, data: m.para, ordem_dia: m.ordem_dia })) })
    if (error) return { ok: false, msg: 'Não foi possível recalcular. Nada foi alterado; tente de novo.' }
  }
  const plano = await planejarCronograma()
  if (!plano.ok) return { ok: false, msg: mov.movimentos.length ? `As revisões foram para os próximos dias, mas o plano não foi refeito: ${plano.msg}` : plano.msg }
  const ids = at.descartar.map(i => i.id)
  for (let i = 0; i < ids.length; i += 200) await sb.from('schedule_items').delete().in('id', ids.slice(i, i + 200)).eq('origem', 'auto').neq('status', 'concluido')
  ;['/inicio', '/cronograma', '/calendario', '/revisoes'].forEach(p => revalidatePath(p, 'layout'))
  return { ok: true, msg: 'Rota recalculada. ' + plano.msg.replace(/^Cronograma atualizado: /, 'Plano refeito a partir de hoje: ') }
}
