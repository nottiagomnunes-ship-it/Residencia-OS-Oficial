import { addDays } from './review'

export type Intervalo = { ini: number; fim: number; titulo?: string; tarefa?: boolean; categoria?: string; id?: string; cor?: string; inicio?: string; recorrente?: boolean } // minutos desde 00:00; inicio = dia em que a ocorrência começa desde 00:00
export type Compromisso = { titulo: string; tipo: 'semanal' | 'pontual'; dias: number[]; data: string | null; ini: number; fim: number; valido_de: string | null; valido_ate: string | null; id?: string; categoria?: string; excecoes?: string[] }
export const MIN_BLOCO = 30

export const hhmmParaMin = (t: string) => { const [h, m] = t.split(':'); return Number(h) * 60 + Number(m) }
export const minParaHhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
export const paraCompromisso = (r: any): Compromisso => ({
  titulo: r.titulo ?? '', tipo: r.tipo, dias: r.dias ?? [], data: r.data ?? null, ini: hhmmParaMin(r.hora_ini), fim: hhmmParaMin(r.hora_fim),
  valido_de: r.valido_de ?? null, valido_ate: r.valido_ate ?? null, ...(r.id ? { id: r.id } : {}), ...(r.categoria ? { categoria: r.categoria } : {}), ...(Array.isArray(r.excecoes) && r.excecoes.length ? { excecoes: r.excecoes } : {}),
})
const dow = (d: string) => new Date(d + 'T00:00:00Z').getUTCDay()

/** Expande os compromissos em intervalos ocupados por data. Horário que vira a noite ocupa o fim do dia e o começo do seguinte. */
export function ocupadosPorData(cs: Compromisso[], de: string, ate: string) {
  const out: Record<string, Intervalo[]> = {}
  const add = (d: string, i: Intervalo) => (out[d] ??= []).push(i)
  for (let d = de; d <= ate; d = addDays(d, 1)) for (const c of cs) {
    const aplica = c.tipo === 'pontual' ? c.data === d : c.dias.includes(dow(d)) && (!c.valido_de || d >= c.valido_de) && (!c.valido_ate || d <= c.valido_ate)
    if (!aplica || c.excecoes?.includes(d)) continue // dia liberado: a ocorrência que começa nele (e a continuação de madrugada) some
    const extra = { ...(c.id ? { id: c.id, inicio: d, recorrente: c.tipo === 'semanal' } : {}), ...(c.categoria ? { categoria: c.categoria } : {}) }
    if (c.fim > c.ini) add(d, { ini: c.ini, fim: c.fim, titulo: c.titulo, ...extra })
    else { add(d, { ini: c.ini, fim: 1440, titulo: c.titulo, ...extra }); add(addDays(d, 1), { ini: 0, fim: c.fim, titulo: `${c.titulo} (continuação)`, ...extra }) }
  }
  return out
}

/** Janelas livres de estudo: [ini, fim] do dia menos os ocupados (com folga de deslocamento). Descarta janelas menores que o bloco mínimo. */
export function janelasDoDia(ini: number, fim: number, ocup: Intervalo[], folga: number): [number, number][] {
  let livres: [number, number][] = [[ini, fim]]
  for (const o of ocup) {
    const a = o.ini - folga, b = o.fim + folga
    livres = livres.flatMap(([x, y]): [number, number][] =>
      b <= x || a >= y ? [[x, y]] : ([[x, Math.min(y, a)], [Math.max(x, b), y]] as [number, number][]).filter(([p, q]) => q > p))
  }
  return livres.filter(([x, y]) => y - x >= MIN_BLOCO)
}

/** Mistura compromissos e itens do dia em ordem de horário; itens sem horário (ex.: revisões) ficam por último. */
export function ordenarDia<T extends { hora_ini: string | null }>(ocup: Intervalo[], itens: T[]) {
  return [
    ...ocup.map(o => ({ tipo: 'ocupado' as const, ini: o.ini, o })),
    ...itens.map(x => ({ tipo: 'item' as const, ini: x.hora_ini ? hhmmParaMin(x.hora_ini) : 99999, x })),
  ].sort((a, b) => a.ini - b.ini)
}

/** Compromissos que se sobrepõem de verdade ao intervalo [ini, fim). Encostar (terminar quando o outro começa) não é conflito. */
export const conflitosComOcupados = (ini: number, fim: number, ocup: Intervalo[]) => ocup.filter(o => ini < o.fim && o.ini < fim)
export function descreverConflitos(c: Intervalo[]) {
  if (!c.length) return null
  return `Este horário cai sobre ${c.map(o => `${o.tarefa ? 'a tarefa ' : ''}"${o.titulo}" (${minParaHhmm(o.ini)}–${o.fim >= 1440 ? '24:00' : minParaHhmm(o.fim)})`).join(' e ')}.`
}
