/** Uma prova do banco = as questões de uma banca e um ano. Com menos que isto, parece mais um punhado de questões soltas do que uma prova. */
export const MINIMO_PROVA = 20

export type LinhaDoBanco = { banca: string | null; ano: number | null; gabarito: string | null; anulada: boolean }
export type ProvaDoBanco = { banca: string; ano: number; questoes: number }

/** As provas (banca + ano) que dá para fazer a partir do banco: só contam questões com gabarito ou anuladas. Mais recentes primeiro. */
export function provasDoBanco(linhas: readonly LinhaDoBanco[]): ProvaDoBanco[] {
  const m = new Map<string, ProvaDoBanco>()
  for (const l of linhas) {
    if (!l.banca || !l.ano || (!l.gabarito && !l.anulada)) continue
    const k = `${l.banca}|${l.ano}`
    const x = m.get(k) ?? { banca: l.banca, ano: l.ano, questoes: 0 }
    x.questoes++; m.set(k, x)
  }
  return [...m.values()].sort((a, b) => b.ano - a.ano || a.banca.localeCompare(b.banca, 'pt-BR'))
}
