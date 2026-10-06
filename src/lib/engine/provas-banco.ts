/** As provas cadastradas no banco geral (Administração → Provas) e quanto de cada uma a pessoa tem para fazer. */
export type ProvaGeral = { id: string; nome: string; banca: string; ano: number; total: number }
export type Ligacao = { prova_id: string; geral_id: string; numero: number }
export type MinhaQuestao = { origem_geral: string | null; gabarito: string | null; anulada: boolean }
export type ProvaParaFazer = ProvaGeral & { disponiveis: number; completa: boolean }

/**
 * Para cada prova: quantas questões dela a pessoa pode fazer (estão no banco dela, com gabarito ou anuladas). Completa = tem todas as
 * `total`. Provas sem nenhuma questão disponível não aparecem. Mais recentes primeiro; depois banca e nome.
 */
export function provasParaFazer(provas: readonly ProvaGeral[], ligacoes: readonly Ligacao[], minhas: readonly MinhaQuestao[]): ProvaParaFazer[] {
  const tenho = new Set(minhas.filter(q => q.origem_geral && (q.gabarito || q.anulada)).map(q => q.origem_geral!))
  const n = new Map<string, Set<number>>()
  for (const l of ligacoes) if (tenho.has(l.geral_id)) { const s = n.get(l.prova_id) ?? new Set(); s.add(l.numero); n.set(l.prova_id, s) }
  return provas.map(p => { const d = n.get(p.id)?.size ?? 0; return { ...p, disponiveis: d, completa: d >= p.total } })
    .filter(p => p.disponiveis > 0)
    .sort((a, b) => b.ano - a.ano || a.banca.localeCompare(b.banca, 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR'))
}

/** Os números que faltam numa prova (1..total sem questão ligada), em faixas curtas para mostrar: "3, 7–9". */
export function numerosQueFaltam(total: number, ligados: readonly number[]): number[] {
  const tem = new Set(ligados)
  return Array.from({ length: total }, (_, i) => i + 1).filter(n => !tem.has(n))
}

/** Palpite para o cadastro de uma prova na importação: a banca e o ano mais comuns entre as questões, nome "BANCA ANO", total = maior número. */
export function palpiteDaProva(itens: readonly { banca: string | null; ano: number | null; numero: number | null }[]) {
  const mais = <T,>(xs: T[]) => { const m = new Map<T, number>(); for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1); return [...m].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null }
  const banca = mais(itens.map(i => i.banca).filter((x): x is string => !!x)), ano = mais(itens.map(i => i.ano).filter((x): x is number => !!x))
  const maior = Math.max(0, ...itens.map(i => i.numero ?? 0))
  return { banca: banca ?? '', ano: ano ?? null, nome: [banca, ano].filter(Boolean).join(' '), total: maior || itens.length }
}

export type GeralComNumero = { id: string; banca: string | null; ano: number | null; colecao: string | null; numero: number | null }
export type GrupoSemProva = { banca: string; ano: number; colecao: string | null; questoes: number; maior: number }

/**
 * Administração: questões publicadas com número na prova que ainda não estão em nenhuma prova cadastrada, agrupadas por banca, ano e coleção
 * (a coleção separa duas provas da mesma banca e ano, quando foram publicadas com coleções diferentes). Os maiores grupos primeiro.
 */
export function gruposSemProva(geral: readonly GeralComNumero[], jaEmProva: ReadonlySet<string>): GrupoSemProva[] {
  const m = new Map<string, GrupoSemProva>()
  for (const g of geral) {
    if (!g.banca || !g.ano || !g.numero || jaEmProva.has(g.id)) continue
    const k = `${g.banca}|${g.ano}|${g.colecao ?? ''}`
    const x = m.get(k) ?? { banca: g.banca, ano: g.ano, colecao: g.colecao, questoes: 0, maior: 0 }
    x.questoes++; x.maior = Math.max(x.maior, g.numero); m.set(k, x)
  }
  return [...m.values()].sort((a, b) => b.questoes - a.questoes || b.ano - a.ano)
}
