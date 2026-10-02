import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays } from './engine/review'
import { calcularRitmo } from './engine/ritmo'
import { contarAssuntos } from './gamificacao-data'

export type ModoRitmo = 'completo' | 'resumo' | 'oculto'

/** Como a pessoa quer ver o ritmo. Sem a migração 0023 (ou com valor desconhecido), vale o padrão: só um resumo. */
export async function carregarModoRitmo(sb: SupabaseClient): Promise<ModoRitmo> {
  const { data } = await sb.from('profiles').select('ritmo_modo').single()
  const m = data?.ritmo_modo
  return m === 'completo' || m === 'oculto' ? m : 'resumo'
}

/** Ritmo para a prova: lê só o necessário (contagens e as datas de conclusão das últimas 4 semanas). */
export async function carregarRitmo(sb: SupabaseClient, hoje: string) {
  const [{ data: p }, assuntos, { data: recentes }, { data: primeiro }, { count: semData }, { count: comData }] = await Promise.all([
    sb.from('profiles').select('exam_date').single(),
    contarAssuntos(sb),
    sb.from('topics').select('completed_date').eq('status', 'concluido').gte('completed_date', addDays(hoje, -27)).limit(1000),
    sb.from('topics').select('completed_date').eq('status', 'concluido').not('completed_date', 'is', null).order('completed_date').limit(1),
    sb.from('topics').select('id', { count: 'exact', head: true }).neq('status', 'concluido').is('planned_date', null),
    sb.from('topics').select('id', { count: 'exact', head: true }).neq('status', 'concluido').not('planned_date', 'is', null),
  ])
  return calcularRitmo({
    hoje, prova: p?.exam_date ?? null, total: assuntos.total, concluidos: assuntos.concluidos,
    primeiraConclusao: primeiro?.[0]?.completed_date ?? null, concluidosRecentes: (recentes ?? []).map(r => r.completed_date as string),
    semData: semData ?? 0, comData: comData ?? 0,
  })
}
