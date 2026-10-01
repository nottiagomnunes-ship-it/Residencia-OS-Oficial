import { pct } from './desempenho'

export const xpSimulado = (total: number) => 20 + Math.floor(total / 5)

/** Ordena por data e calcula % de cada simulado, variação em pontos sobre o anterior, média e melhor. */
export function resumoSimulados(ms: { id: string; nome: string; data: string; total: number; acertos: number }[]) {
  const ord = [...ms].sort((a, b) => a.data.localeCompare(b.data))
  const itens = ord.map((m, i) => {
    const p = pct(m.acertos, m.total) ?? 0, ant = i > 0 ? pct(ord[i - 1].acertos, ord[i - 1].total) ?? 0 : null
    return { ...m, pct: p, variacao: ant == null ? null : p - ant }
  })
  return { itens, media: itens.length ? Math.round(itens.reduce((s, x) => s + x.pct, 0) / itens.length) : null, melhor: itens.length ? Math.max(...itens.map(x => x.pct)) : null }
}
