/** Chave para juntar pedidos da mesma prova: banca sem acento, caixa, espaços e pontuação ("USP - SP" = "usp sp" = "USP-SP") + ano. */
export const chaveDaProva = (banca: string, ano: number | null) =>
  `${banca.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')}|${ano ?? ''}`

export type Pedido = { id: string; banca: string | null; ano: number | null; anexo?: string | null; criada_em: string }
export type ProvaPedida = { chave: string; banca: string; ano: number | null; pedidos: number; comPdf: number; primeiro: string }

/** As provas pedidas (em aberto), da mais pedida para a menos; empate: o pedido mais antigo primeiro. */
export function provasPedidas(pedidos: readonly Pedido[]): ProvaPedida[] {
  const m = new Map<string, ProvaPedida>()
  for (const p of pedidos) {
    if (!p.banca) continue
    const k = chaveDaProva(p.banca, p.ano)
    const x = m.get(k) ?? { chave: k, banca: p.banca, ano: p.ano, pedidos: 0, comPdf: 0, primeiro: p.criada_em }
    x.pedidos++; if (p.anexo) x.comPdf++; if (p.criada_em < x.primeiro) x.primeiro = p.criada_em
    m.set(k, x)
  }
  return [...m.values()].sort((a, b) => b.pedidos - a.pedidos || (a.primeiro < b.primeiro ? -1 : 1))
}
