import { addDays, diffDays } from './review'
import { hhmmParaMin, minParaHhmm } from './compromissos'

export type Visao = 'dia' | 'semana' | 'mes'
/** Segunda-feira da semana de `iso`. */
export const weekStart = (iso: string) => addDays(iso, -((new Date(iso + 'T00:00:00Z').getUTCDay() + 6) % 7))
export const lastOfMonth = (iso: string) => { const [y, m] = iso.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) }

/** Dias exibidos: 1 (dia), 7 (semana) ou a grade do mês completa, começando na segunda. */
export function diasDaVisao(v: Visao, ancora: string) {
  if (v === 'dia') return [ancora]
  if (v === 'semana') { const s = weekStart(ancora); return Array.from({ length: 7 }, (_, i) => addDays(s, i)) }
  const s = weekStart(ancora.slice(0, 8) + '01'), n = Math.ceil((diffDays(s, lastOfMonth(ancora)) + 1) / 7) * 7
  return Array.from({ length: n }, (_, i) => addDays(s, i))
}
/** Âncora anterior (-1) ou seguinte (+1). */
export function mover(v: Visao, ancora: string, dir: 1 | -1) {
  if (v === 'dia') return addDays(ancora, dir)
  if (v === 'semana') return addDays(ancora, 7 * dir)
  const [y, m] = ancora.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + dir, 1)).toISOString().slice(0, 10)
}
/** Status visual derivado da data: concluído; atrasado (só depois que o dia da tarefa termina); próximo (hoje ou amanhã); agendado. */
export function statusDe(i: { status: string; data: string }, hoje: string) {
  if (i.status === 'concluido') return 'concluido'
  if (i.data < hoje) return 'atrasado'
  return diffDays(hoje, i.data) <= 1 ? 'proximo' : 'agendado'
}

export type EdicaoCampos = { titulo: string; hora: string; dur: string; qtd: string }
/** Valida a edição de uma tarefa. Em revisões o título não muda (vem do assunto). Hora sem duração fica sem hora de fim. */
export function validarEdicaoTarefa(c: EdicaoCampos, revisao: boolean):
  { erro: string } | { titulo: string; hora_ini: string | null; hora_fim: string | null; dur: number | null; qtd: number | null } {
  const titulo = c.titulo.trim().slice(0, 160), dur = c.dur ? Number(c.dur) : null, qtd = c.qtd ? Number(c.qtd) : null
  if (!revisao && !titulo) return { erro: 'Dê um título à tarefa.' }
  if (c.hora && (!/^\d{2}:\d{2}$/.test(c.hora) || +c.hora.slice(0, 2) > 23 || +c.hora.slice(3) > 59)) return { erro: 'Horário inválido.' }
  if (dur != null && !(Number.isInteger(dur) && dur >= 5 && dur <= 720)) return { erro: 'A duração deve ficar entre 5 e 720 minutos.' }
  if (qtd != null && !(Number.isInteger(qtd) && qtd >= 1 && qtd <= 1000)) return { erro: 'O número de questões deve ficar entre 1 e 1000.' }
  const ini = c.hora ? hhmmParaMin(c.hora) : null
  if (ini != null && dur != null && ini + dur >= 1440) return { erro: 'A tarefa não pode passar da meia-noite.' }
  return { titulo, hora_ini: c.hora || null, hora_fim: ini != null && dur != null ? minParaHhmm(ini + dur) : null, dur, qtd }
}
