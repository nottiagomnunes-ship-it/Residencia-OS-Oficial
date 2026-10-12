import type { SupabaseClient } from '@supabase/supabase-js'
import { hojeBR } from '@/lib/dates'
import { carregarDesempenho } from '@/lib/desempenho-data'
import { gerarCronograma, primeiraDataPorAssunto } from '@/lib/engine/schedule'
import { emBlocos } from '@/lib/paginar'

export type RevisaoExtra = { data: string; duracao_min: number | null; topic_id: string | null; nome?: string }

/**
 * Calcula o plano do "Gerar cronograma" / "Recalcular rota" SEM gravar nada (a gravação fica em `planejarCronograma`).
 * Só no servidor: recebe o cliente já autenticado. `extraRevisoes` = revisões atrasadas que a prévia vai mover para os próximos dias.
 */
export async function calcularPlano(sb: SupabaseClient, uid: string, extraRevisoes?: RevisaoExtra[]) {
  const agora = hojeBR()
  const { data: p } = await sb.from('profiles').select('exam_date,study_start_date,daily_minutes,daily_questions_goal,available_weekdays').eq('id', uid).single()
  if (!p?.exam_date) return { ok: false as const, msg: 'Defina a data da prova para gerar o cronograma.' }
  const hoje = p.study_start_date && p.study_start_date > agora ? p.study_start_date : agora

  const [{ data: ds }, { data: ts }, { data: rv }, { data: cap }] = await Promise.all([
    sb.from('disciplines').select('id,nome,peso'),
    sb.from('topics').select('id,nome,discipline_id,prioridade,dificuldade,planned_date,planned_auto,status,ordem,grupo').neq('status', 'concluido'),
    sb.from('schedule_items').select('data,duracao_min,topic_id,topics(nome)').eq('tipo', 'revisao').neq('status', 'concluido').gte('data', hoje),
    sb.from('capacidade_dia').select('data,minutos').gte('data', hoje),
  ])
  const minutosRevisaoPorDia: Record<string, number> = {}
  const revisoesPorDia: Record<string, { nome: string; id?: string }[]> = {}
  // + revisões que ainda vão ser movidas (prévia do "Recalcular rota": elas ainda estão atrasadas no banco)
  const todas = [...(rv ?? []).map(r => { const t = (r as any).topics; return { data: r.data as string, duracao_min: r.duracao_min as number | null, topic_id: (r as any).topic_id as string | null, nome: (Array.isArray(t) ? t[0]?.nome : t?.nome) as string | undefined } }), ...(extraRevisoes ?? [])]
  for (const r of todas) {
    minutosRevisaoPorDia[r.data] = (minutosRevisaoPorDia[r.data] ?? 0) + (r.duracao_min ?? 30)
    if (r.nome) (revisoesPorDia[r.data] ??= []).push({ nome: r.nome, id: r.topic_id ?? undefined })
  }

  // partes já concluídas de assuntos divididos (o assunto ainda não terminou): o gerador agenda só o que falta
  const feito = new Map<string, number>()
  const abertos = (ts ?? []).filter(t => t.status === 'em_andamento').map(t => t.id as string)
  if (abertos.length) {
    const { data: ps } = await emBlocos<{ topic_id: string; duracao_min: number | null }>(abertos, b => sb.from('schedule_items').select('topic_id,duracao_min').eq('tipo', 'estudo').eq('status', 'concluido').in('topic_id', b))
    for (const x of ps ?? []) feito.set(x.topic_id, (feito.get(x.topic_id) ?? 0) + (x.duracao_min ?? 0))
  }
  const topicos = (ts ?? []).map(t => ({ id: t.id, nome: t.nome, disciplineId: t.discipline_id, prioridade: t.prioridade, dificuldade: t.dificuldade, plannedDate: t.planned_date, ordem: t.ordem, grupo: t.grupo, feitoMin: feito.get(t.id) }))
  const ehFixo = (t: { plannedDate?: string | null }, orig: any) => !!t.plannedDate && t.plannedDate >= hoje && !orig.planned_auto
  const origem = new Map((ts ?? []).map(t => [t.id, t]))
  const fixos = topicos.filter(t => ehFixo(t, origem.get(t.id)))
  const auto = topicos.filter(t => !fixos.includes(t))

  const des = await carregarDesempenho(sb, hoje)
  const capacidadePorDia = Object.fromEntries((cap ?? []).map(c => [c.data as string, c.minutos as number])) // tempo informado em "Minha semana"
  const reforcos = des.assuntos.filter(x => x.status === 'concluido' && x.nivel === 'alta').sort((x, y) => y.pontos - x.pontos).slice(0, 3)
    .map(x => ({ id: x.id, nome: x.nome, disciplineId: x.disciplineId, prioridade: 1, dificuldade: 2 }))
  const fracos = des.assuntos.filter(x => x.pct != null && x.nivel !== 'baixa').sort((x, y) => y.pontos - x.pontos).slice(0, 2)
    .map(x => ({ id: x.id, nome: x.nome, disciplineId: x.disciplineId }))
  const r = gerarCronograma({
    hoje, prova: p.exam_date, diasDisponiveis: p.available_weekdays ?? [1, 2, 3, 4, 5, 6], minutosDia: p.daily_minutes ?? 240,
    questoesDia: p.daily_questions_goal ?? 0, disciplinas: ds ?? [], topicos: auto, fixos, minutosRevisaoPorDia, reforcos, revisoesPorDia, fracos,
    capacidadePorDia,
  })

  const fixoIds = new Set(fixos.map(t => t.id))
  const plan = r.blocos.filter(b => b.tipo === 'estudo' && b.topic_id && !fixoIds.has(b.topic_id))
  return { ok: true as const, hoje, r, fixos, plan, topicosDoPlano: primeiraDataPorAssunto(plan) }
}
