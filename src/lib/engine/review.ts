// Motor de revisão espaçada: funções puras, sem UI e sem banco.
export function addDays(iso: string, n: number) {
  const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10)
}
/** Dias de a até b (positivo se b é depois de a). */
export const diffDays = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000)

/** Gera as revisões (D1, D7, D30...) a partir da data do estudo. Intervalos são ordenados e sem repetição. */
export function generateReviews(studyDate: string, intervals: number[]) {
  const ivs = [...new Set(intervals.filter(n => Number.isInteger(n) && n > 0))].sort((a, b) => a - b)
  return ivs.map((d, i) => ({ numero: i + 1, interval_days: d, due_date: addDays(studyDate, d) }))
}

/** Multiplicador do próximo intervalo: difícil/<60% encurta, fácil/≥80% alonga. */
export function intervalFactor(desempenho: number | null, dificuldade: number | null) {
  if (desempenho != null) return desempenho < 60 ? 0.5 : desempenho >= 80 ? 1.3 : 1
  return dificuldade === 3 ? 0.5 : dificuldade === 1 ? 1.3 : 1
}

/** Data da próxima revisão, contada a partir do dia em que a revisão atual foi feita. */
export function nextDueAfterReview(completedOn: string, prevInterval: number, nextInterval: number, desempenho: number | null, dificuldade: number | null) {
  const gap = Math.max(1, Math.round((nextInterval - prevInterval) * intervalFactor(desempenho, dificuldade)))
  return addDays(completedOn, gap)
}

/** Ordem da fila: atraso pesa mais, depois assunto fraco, peso da disciplina e primeira revisão. */
export function priorityScore(x: { diasAtraso: number; acerto: number | null; peso: number; numero: number }) {
  return Math.max(0, x.diasAtraso) * 3 + (100 - (x.acerto ?? 70)) * 0.5 + x.peso * 2 + (x.numero === 1 ? 2 : 0)
}

export const xpEstudo = (min: number) => 30 + Math.floor(min / 10)
export const xpRevisao = (desempenho: number | null) => 15 + (desempenho != null && desempenho >= 80 ? 5 : 0)
export const levelFor = (xp: number) => Math.floor(xp / 500) + 1
