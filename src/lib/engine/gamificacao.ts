import { addDays, diffDays } from './review'
import { tituloDoNivel, proximoTitulo } from './rank'

export const XP_POR_NIVEL = 500 // mesma regra de levelFor()

export function nivelDoXp(xp: number) {
  const nivel = Math.floor(xp / XP_POR_NIVEL) + 1, no = xp % XP_POR_NIVEL
  return { nivel, nome: tituloDoNivel(nivel), proximoTitulo: proximoTitulo(nivel), xpNoNivel: no, xpParaProximo: XP_POR_NIVEL - no, pct: Math.round((no / XP_POR_NIVEL) * 100) }
}

/** Sequência atual (não quebra até o fim do dia de hoje) e a melhor já registrada. */
export function sequencias(dias: string[], hoje: string) {
  const s = new Set(dias)
  let atual = 0, d = s.has(hoje) ? hoje : addDays(hoje, -1)
  while (s.has(d)) { atual++; d = addDays(d, -1) }
  let melhor = 0, run = 0
  const ord = [...s].sort()
  ord.forEach((x, i) => { run = i > 0 && diffDays(ord[i - 1], x) === 1 ? run + 1 : 1; melhor = Math.max(melhor, run) })
  return { atual, melhor }
}

/** Alguma disciplina com 5+ assuntos e todos concluídos. */
export function disciplinaCompleta(ts: { discipline_id: string; status: string }[], minimo = 5) {
  const m = new Map<string, { n: number; ok: number }>()
  for (const t of ts) { const a = m.get(t.discipline_id) ?? { n: 0, ok: 0 }; a.n++; if (t.status === 'concluido') a.ok++; m.set(t.discipline_id, a) }
  return [...m.values()].some(x => x.n >= minimo && x.ok === x.n)
}
/** Algum assunto com 3+ etapas e todas feitas. */
export function assuntoCompleto(tasks: { topic_id: string; concluida: boolean }[], minimo = 3) {
  const m = new Map<string, { n: number; ok: number }>()
  for (const t of tasks) { const a = m.get(t.topic_id) ?? { n: 0, ok: 0 }; a.n++; if (t.concluida) a.ok++; m.set(t.topic_id, a) }
  return [...m.values()].some(x => x.n >= minimo && x.ok === x.n)
}

export type Stats = {
  melhorSequencia: number; questoes: number; conteudos: number; revisoes: number; simulados: number; horas: number
  etapas: number; assuntoCompleto: boolean; erros: number; errosRevisados: number; simuladoMelhor: number
  metaBatida: boolean; maiorDiaQuestoes: number; maiorDiaMinutos: number; acertoGeral: number | null; disciplinaCompleta: boolean
}
export const STATS_ZERO: Stats = {
  melhorSequencia: 0, questoes: 0, conteudos: 0, revisoes: 0, simulados: 0, horas: 0, etapas: 0, assuntoCompleto: false, erros: 0,
  errosRevisados: 0, simuladoMelhor: 0, metaBatida: false, maiorDiaQuestoes: 0, maiorDiaMinutos: 0, acertoGeral: null, disciplinaCompleta: false,
}
const c = (codigo: string, titulo: string, descricao: string, ok: (s: Stats) => boolean) => ({ codigo, titulo, descricao, ok })
export const CONQUISTAS = [
  c('primeiro_conteudo', 'Primeiro passo', 'Conclua seu primeiro conteúdo', s => s.conteudos >= 1),
  c('questoes_100', 'Cem questões', 'Resolva 100 questões', s => s.questoes >= 100),
  c('questoes_500', 'Quinhentas questões', 'Resolva 500 questões', s => s.questoes >= 500),
  c('questoes_1000', 'Mil questões', 'Resolva 1.000 questões', s => s.questoes >= 1000),
  c('revisoes_25', 'Revisor constante', 'Faça 25 revisões', s => s.revisoes >= 25),
  c('sequencia_7', 'Semana completa', 'Estude 7 dias seguidos', s => s.melhorSequencia >= 7),
  c('sequencia_30', 'Mês de constância', 'Estude 30 dias seguidos', s => s.melhorSequencia >= 30),
  c('simulado_1', 'Teste de fogo', 'Faça seu primeiro simulado', s => s.simulados >= 1),
  c('horas_50', '50 horas', 'Acumule 50 horas de estudo', s => s.horas >= 50),
  c('horas_200', '200 horas', 'Acumule 200 horas de estudo', s => s.horas >= 200),
  c('sequencia_3', 'Aquecendo', 'Estude 3 dias seguidos', s => s.melhorSequencia >= 3),
  c('sequencia_14', 'Duas semanas firmes', 'Estude 14 dias seguidos', s => s.melhorSequencia >= 14),
  c('conteudos_10', 'Dez conteúdos', 'Conclua 10 conteúdos', s => s.conteudos >= 10),
  c('conteudos_50', 'Meio caminho', 'Conclua 50 conteúdos', s => s.conteudos >= 50),
  c('revisoes_100', 'Memória afiada', 'Faça 100 revisões', s => s.revisoes >= 100),
  c('etapas_10', 'Metódico', 'Conclua 10 etapas de assuntos', s => s.etapas >= 10),
  c('etapas_50', 'Checklist em dia', 'Conclua 50 etapas de assuntos', s => s.etapas >= 50),
  c('assunto_completo', 'Tudo feito', 'Conclua todas as etapas de um assunto (mínimo de 3)', s => s.assuntoCompleto),
  c('erros_10', 'Aprendendo com os erros', 'Registre 10 erros no caderno', s => s.erros >= 10),
  c('erros_revisados_10', 'Erro revisado, erro vencido', 'Revise 10 erros do caderno', s => s.errosRevisados >= 10),
  c('simulados_5', 'Rotina de simulados', 'Faça 5 simulados', s => s.simulados >= 5),
  c('simulado_75', 'Nota alta', 'Acerte 75% ou mais em um simulado (30+ questões)', s => s.simuladoMelhor >= 75),
  c('meta_batida', 'Meta batida', 'Alcance 100% de qualquer meta', s => s.metaBatida),
  c('maratona_100', 'Dia de maratona', 'Resolva 100 questões em um único dia', s => s.maiorDiaQuestoes >= 100),
  c('foco_4h', 'Dia de foco', 'Estude 4 horas em um único dia', s => s.maiorDiaMinutos >= 240),
  c('precisao_80', 'Precisão', 'Mantenha 80% de acerto com 200+ questões', s => s.questoes >= 200 && (s.acertoGeral ?? 0) >= 80),
  c('disciplina_completa', 'Disciplina concluída', 'Conclua todos os assuntos de uma disciplina (mínimo de 5)', s => s.disciplinaCompleta),
  c('horas_100', '100 horas', 'Acumule 100 horas de estudo', s => s.horas >= 100),
]
export const desbloqueadas = (s: Stats) => CONQUISTAS.filter(x => x.ok(s)).map(x => x.codigo)
