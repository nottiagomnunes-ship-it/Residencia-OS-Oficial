'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { hojeBR } from '@/lib/dates'
import { carregarDesempenho } from '@/lib/desempenho-data'
import { addDays } from '@/lib/engine/review'
import { hhmmParaMin, ocupadosPorData, paraCompromisso } from '@/lib/engine/compromissos'
import { gerarCronograma } from '@/lib/engine/schedule'

/** Gera ou atualiza o cronograma: recalcula tudo que é automático e mantém revisões, concluídos e itens manuais. */
export async function gerarCronogramaAction() {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  const uid = user.id, agora = hojeBR()
  const { data: p } = await sb.from('profiles').select('exam_date,study_start_date,daily_minutes,daily_questions_goal,available_weekdays,janela_ini,janela_fim,folga_min').eq('id', uid).single()
  if (!p?.exam_date) redirect('/cronograma?msg=' + encodeURIComponent('Defina a data da prova para gerar o cronograma.'))
  const hoje = p.study_start_date && p.study_start_date > agora ? p.study_start_date : agora

  const [{ data: ds }, { data: ts }, { data: rv }, { data: cm }] = await Promise.all([
    sb.from('disciplines').select('id,nome,peso'),
    sb.from('topics').select('id,nome,discipline_id,prioridade,dificuldade,planned_date,planned_auto,status,ordem,grupo').neq('status', 'concluido'),
    sb.from('schedule_items').select('data,duracao_min,topic_id,topics(nome)').eq('tipo', 'revisao').neq('status', 'concluido').gte('data', hoje),
    sb.from('commitments').select('tipo,titulo,dias,data,hora_ini,hora_fim,valido_de,valido_ate'),
  ])
  const minutosRevisaoPorDia: Record<string, number> = {}
  const revisoesPorDia: Record<string, { nome: string; id?: string }[]> = {}
  for (const r of rv ?? []) {
    minutosRevisaoPorDia[r.data] = (minutosRevisaoPorDia[r.data] ?? 0) + (r.duracao_min ?? 30)
    const t = (r as any).topics, n = Array.isArray(t) ? t[0]?.nome : t?.nome
    if (n) (revisoesPorDia[r.data] ??= []).push({ nome: n, id: (r as any).topic_id })
  }

  const topicos = (ts ?? []).map(t => ({ id: t.id, nome: t.nome, disciplineId: t.discipline_id, prioridade: t.prioridade, dificuldade: t.dificuldade, plannedDate: t.planned_date, ordem: t.ordem, grupo: t.grupo }))
  const ehFixo = (t: { plannedDate?: string | null }, orig: any) => !!t.plannedDate && t.plannedDate >= hoje && !orig.planned_auto
  const origem = new Map((ts ?? []).map(t => [t.id, t]))
  const fixos = topicos.filter(t => ehFixo(t, origem.get(t.id)))
  const auto = topicos.filter(t => !fixos.includes(t))

  const des = await carregarDesempenho(sb, hoje)
  const ocupados = ocupadosPorData((cm ?? []).map(paraCompromisso), addDays(hoje, -1), p.exam_date)
  const { data: manuais } = await sb.from('schedule_items').select('data,hora_ini,hora_fim,duracao_min,titulo').eq('origem', 'manual').neq('status', 'concluido').gte('data', hoje).not('hora_ini', 'is', null)
  for (const m of manuais ?? []) {
    const ini = hhmmParaMin(m.hora_ini), fim = m.hora_fim ? hhmmParaMin(m.hora_fim) : ini + (m.duracao_min ?? 30)
    ;(ocupados[m.data] ??= []).push({ ini, fim: fim > ini ? fim : 1440, titulo: m.titulo })
  }
  const reforcos = des.assuntos.filter(x => x.status === 'concluido' && x.nivel === 'alta').sort((x, y) => y.pontos - x.pontos).slice(0, 3)
    .map(x => ({ id: x.id, nome: x.nome, disciplineId: x.disciplineId, prioridade: 1, dificuldade: 2 }))
  const fracos = des.assuntos.filter(x => x.pct != null && x.nivel !== 'baixa').sort((x, y) => y.pontos - x.pontos).slice(0, 2)
    .map(x => ({ id: x.id, nome: x.nome, disciplineId: x.disciplineId }))
  const r = gerarCronograma({
    hoje, prova: p.exam_date, diasDisponiveis: p.available_weekdays ?? [1, 2, 3, 4, 5, 6], minutosDia: p.daily_minutes ?? 240,
    questoesDia: p.daily_questions_goal ?? 0, disciplinas: ds ?? [], topicos: auto, fixos, minutosRevisaoPorDia, reforcos, revisoesPorDia, fracos,
    janela: { ini: hhmmParaMin(p.janela_ini ?? '06:00'), fim: hhmmParaMin(p.janela_fim ?? '23:00') }, ocupados, folga: p.folga_min ?? 30,
  })

  // troca o plano automático antigo pelo novo numa única transação (revisões, concluídos e itens manuais não são tocados)
  const fixoIds = new Set(fixos.map(t => t.id))
  const plan = r.blocos.filter(b => b.tipo === 'estudo' && b.topic_id && !fixoIds.has(b.topic_id))
  const { error: falha } = await sb.rpc('aplicar_cronograma', {
    p_hoje: hoje,
    p_blocos: r.blocos.map(b => ({ tipo: b.tipo, topic_id: b.topic_id, titulo: b.titulo, data: b.data, hora_ini: b.hora_ini ?? null, hora_fim: b.hora_fim ?? null, duracao_min: b.duracao_min, qtd_questoes: b.qtd_questoes })),
    p_topicos: plan.map(b => ({ id: b.topic_id, data: b.data })),
  })
  if (falha) redirect('/cronograma?msg=' + encodeURIComponent('Não foi possível atualizar o cronograma. O plano anterior foi mantido; tente de novo.'))

  ;['/cronograma', '/calendario', '/conteudos', '/disciplinas', '/inicio'].forEach(x => revalidatePath(x, 'layout'))
  const n = plan.length + fixos.length
  redirect('/cronograma?msg=' + encodeURIComponent(`Cronograma atualizado: ${n} assuntos planejados. ${r.avisos.join(' ')}`.trim()))
}
