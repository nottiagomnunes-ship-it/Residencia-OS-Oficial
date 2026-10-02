import { addDays } from './review'
import { weekStart } from './calendar'

export const OPCOES_TEMPO = [0, 30, 60, 90, 120, 180, 240]
const dow = (d: string) => new Date(d + 'T00:00:00Z').getUTCDay()

/** 0 → "Sem tempo", 45 → "45 min", 60 → "1 h", 90 → "1 h 30". */
export function formatarMinutos(m: number) {
  if (m <= 0) return 'Sem tempo'
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60), r = m % 60
  return r ? `${h} h ${r}` : `${h} h`
}

/** Tempo de estudo de um dia: o que a pessoa informou ou, sem informação, o tempo padrão nos dias disponíveis (e zero nos demais). */
export function capacidadeDoDia(data: string, informados: Record<string, number>, minutosPadrao: number, diasDisponiveis: number[]) {
  if (informados[data] !== undefined) return { minutos: informados[data], informado: true }
  return { minutos: diasDisponiveis.includes(dow(data)) ? minutosPadrao : 0, informado: false }
}

/**
 * Do que está aberto (já em ordem de prioridade), o que cabe no tempo informado e o que fica para depois.
 * Segue a ordem à risca: ao primeiro item que não cabe, o resto fica para depois. Se nada cabe, mostra a primeira tarefa mesmo assim (avisando).
 */
export function dividirPorTempo<T extends { duracao_min: number | null }>(itens: T[], minutos: number) {
  const dur = (i: T) => i.duracao_min ?? 30
  const cabem: T[] = [], sobram: T[] = []
  let usado = 0, parou = false
  for (const i of itens) {
    if (!parou && usado + dur(i) <= minutos) { cabem.push(i); usado += dur(i) } else { parou = true; sobram.push(i) }
  }
  if (!cabem.length && minutos > 0 && sobram.length) { const primeira = sobram.shift()!; return { cabem: [primeira], sobram, usado: dur(primeira), maiorQueOTempo: true } }
  return { cabem, sobram, usado, maiorQueOTempo: false }
}

/** Os 7 dias a partir de uma segunda-feira. */
export const diasDaSemana = (segunda: string) => Array.from({ length: 7 }, (_, i) => addDays(segunda, i))

/** Das tarefas dos próximos dias, as que cabem no tempo que sobra hoje (na ordem do plano). Menos de 30 min livres, ou nada que caiba: nenhuma. */
export function escolherAdiantar<T extends { duracao_min: number | null }>(candidatos: T[], livre: number) {
  if (livre < 30) return []
  const r = dividirPorTempo(candidatos, livre)
  return r.maiorQueOTempo ? [] : r.cabem
}

/**
 * Semana cujo tempo ainda não foi informado e que merece um lembrete: de sexta a domingo, a próxima; de segunda a quinta, a atual.
 * Devolve a segunda-feira dessa semana, ou null se algum dia dela (de hoje em diante) já tem tempo informado.
 */
export function semanaAAvisar(hoje: string, informados: Record<string, number>): string | null {
  const d = dow(hoje), seg = weekStart(hoje), alvo = d === 5 || d === 6 || d === 0 ? addDays(seg, 7) : seg
  return diasDaSemana(alvo).filter(x => x >= hoje).some(x => informados[x] !== undefined) ? null : alvo
}

/** O tempo da semana mudou depois da última vez que o cronograma foi gerado (ou ele nunca foi gerado). */
export const planoDesatualizado = (alteradoEm: string | null | undefined, geradoEm: string | null | undefined) =>
  !!alteradoEm && (!geradoEm || Date.parse(alteradoEm) > Date.parse(geradoEm))
