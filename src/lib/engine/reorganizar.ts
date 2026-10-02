import { addDays } from './review'

export type ItemPlano = { id: string; tipo: string; data: string; duracao_min: number | null; ordem_dia: number | null }
export type Movimento = { id: string; de: string; para: string; ordem_dia: number; duracao_min: number }

// revisões primeiro (a memória depende do prazo), depois estudo, depois questões/flashcards, e o simulado por último
const PRIORIDADE: Record<string, number> = { revisao: 0, estudo: 1, flashcards: 2, questoes: 2, simulado: 3 }
const dur = (i: { duracao_min: number | null }) => i.duracao_min ?? 30

/**
 * Distribui as tarefas atrasadas pelos próximos dias, sem passar do tempo de cada dia.
 * Cada tarefa vai para o primeiro dia (a partir de hoje) em que ainda cabe, e entra à frente das tarefas que o dia já tinha.
 * O que não cabe em nenhum dia do período fica de fora (semLugar) e permanece como está.
 */
export function reorganizarAtrasadas(p: {
  hoje: string; dias: number; atrasadas: ItemPlano[]; abertos: ItemPlano[]; capacidade: (data: string) => number; feitosHoje?: number
}): { movimentos: Movimento[]; semLugar: ItemPlano[] } {
  const dias = Array.from({ length: Math.max(1, p.dias) }, (_, k) => addDays(p.hoje, k))
  const livre = new Map<string, number>()
  for (const d of dias) {
    const usado = p.abertos.filter(i => i.data === d).reduce((s, i) => s + dur(i), 0)
    livre.set(d, Math.max(0, p.capacidade(d) - usado - (d === p.hoje ? p.feitosHoje ?? 0 : 0)))
  }
  const ordenadas = [...p.atrasadas].sort((a, b) => (PRIORIDADE[a.tipo] ?? 2) - (PRIORIDADE[b.tipo] ?? 2) || a.data.localeCompare(b.data) || (a.ordem_dia ?? 1e9) - (b.ordem_dia ?? 1e9))
  const porDia = new Map<string, ItemPlano[]>(), semLugar: ItemPlano[] = []
  for (const it of ordenadas) {
    const d = dias.find(x => (livre.get(x) ?? 0) >= dur(it))
    if (!d) { semLugar.push(it); continue }
    livre.set(d, livre.get(d)! - dur(it))
    const l = porDia.get(d) ?? []; l.push(it); porDia.set(d, l)
  }
  const movimentos: Movimento[] = []
  for (const d of dias) {
    const mv = porDia.get(d); if (!mv) continue
    const ords = p.abertos.filter(i => i.data === d && i.ordem_dia != null).map(i => i.ordem_dia as number)
    const base = (ords.length ? Math.min(...ords) : 1) - mv.length // as movidas ficam antes das que o dia já tinha
    mv.forEach((it, k) => movimentos.push({ id: it.id, de: it.data, para: d, ordem_dia: base + k, duracao_min: dur(it) }))
  }
  return { movimentos, semLugar }
}
