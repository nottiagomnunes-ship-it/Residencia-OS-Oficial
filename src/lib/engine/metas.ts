import { addDays } from './review'
import { weekStart, lastOfMonth } from './calendar'

export type Periodo = 'dia' | 'semana' | 'mes'
export const PERIODOS: Record<Periodo, string> = { dia: 'Diárias', semana: 'Semanais', mes: 'Mensais' }
export const METRICAS = {
  questoes: { rotulo: 'Questões', unidade: 'questões' }, horas: { rotulo: 'Horas de estudo', unidade: 'h' },
  conteudos: { rotulo: 'Conteúdos concluídos', unidade: 'conteúdos' }, revisoes: { rotulo: 'Revisões feitas', unidade: 'revisões' },
  acerto: { rotulo: 'Aproveitamento', unidade: '%' },
} as const
export type Metrica = keyof typeof METRICAS

/** Metas são recorrentes: a janela é sempre o dia, a semana (seg–dom) ou o mês corrente. */
export function janelaDaMeta(p: Periodo, hoje: string) {
  if (p === 'dia') return { inicio: hoje, fim: hoje }
  if (p === 'semana') { const s = weekStart(hoje); return { inicio: s, fim: addDays(s, 6) } }
  return { inicio: hoje.slice(0, 8) + '01', fim: lastOfMonth(hoje) }
}
export const progressoMeta = (valor: number, alvo: number) => (alvo > 0 ? Math.round((valor / alvo) * 100) : 0)
