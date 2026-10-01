import type { SupabaseClient } from '@supabase/supabase-js'
import { janelaDaMeta, progressoMeta, type Metrica, type Periodo } from './engine/metas'
import { addDays } from './engine/review'
import { pct } from './engine/desempenho'

/** Metas com o valor atual calculado ao vivo a partir dos dados registrados no período corrente. */
export async function carregarMetas(sb: SupabaseClient, hoje: string) {
  const { data: gs } = await sb.from('goals').select('id,periodo,metrica,alvo').order('alvo')
  if (!gs?.length) return []
  const jan = gs.map(g => janelaDaMeta(g.periodo as Periodo, hoje))
  const ini = jan.map(j => j.inicio).sort()[0], fim = jan.map(j => j.fim).sort().at(-1)!
  const [{ data: qs }, { data: st }, { data: tp }, { data: rv }] = await Promise.all([
    sb.from('question_sets').select('total,acertos,realizado_em').gte('realizado_em', ini).lte('realizado_em', fim),
    sb.from('daily_stats').select('data,minutos').gte('data', ini).lte('data', fim),
    sb.from('topics').select('completed_date').gte('completed_date', ini).lte('completed_date', fim),
    sb.from('reviews').select('completed_at').eq('status', 'concluida').gte('completed_at', ini).lt('completed_at', addDays(fim, 1)),
  ])
  return gs.map((g, i) => {
    const { inicio, fim: f } = jan[i], dentro = (d: string) => d >= inicio && d <= f
    const q = (qs ?? []).filter(x => dentro(x.realizado_em))
    const valor = ({
      questoes: q.reduce((n, x) => n + x.total, 0),
      horas: Math.round((st ?? []).filter(x => dentro(x.data)).reduce((n, x) => n + x.minutos, 0) / 6) / 10,
      conteudos: (tp ?? []).filter(x => dentro(x.completed_date)).length,
      revisoes: (rv ?? []).filter(x => dentro(String(x.completed_at).slice(0, 10))).length,
      acerto: pct(q.reduce((n, x) => n + x.acertos, 0), q.reduce((n, x) => n + x.total, 0)) ?? 0,
    } as Record<Metrica, number>)[g.metrica as Metrica] ?? 0
    return { id: g.id as string, periodo: g.periodo as Periodo, metrica: g.metrica as Metrica, alvo: g.alvo as number, valor, pct: progressoMeta(valor, g.alvo) }
  })
}
