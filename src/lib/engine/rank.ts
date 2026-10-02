/** Títulos por nível (500 XP por nível) e ranking por % de assuntos concluídos, no estilo dos jogos competitivos. */

export const TITULOS = [
  { desde: 1, nome: 'Calouro' }, { desde: 3, nome: 'Acadêmico' }, { desde: 6, nome: 'Interno' }, { desde: 10, nome: 'Plantonista' },
  { desde: 15, nome: 'Clínico' }, { desde: 20, nome: 'Diagnosticador' }, { desde: 25, nome: 'Chefe de Plantão' }, { desde: 30, nome: 'Residente' },
  { desde: 40, nome: 'Chefe de Residência' }, { desde: 50, nome: 'Preceptor' }, { desde: 65, nome: 'Especialista' }, { desde: 80, nome: 'Mestre' },
  { desde: 100, nome: 'Professor Titular' },
]
export const indiceTitulo = (nivel: number) => TITULOS.reduce((i, t, k) => (t.desde <= nivel ? k : i), 0)
export const tituloDoNivel = (nivel: number) => TITULOS[indiceTitulo(nivel)].nome
export const proximoTitulo = (nivel: number) => TITULOS[indiceTitulo(nivel) + 1] ?? null

// 10 elos de 10% cada. Os 7 primeiros têm 4 divisões (IV a I, de 2,5 em 2,5%); Mestre, Grão-Mestre e Desafiante não têm divisões.
export const ELOS = [
  { nome: 'Ferro', cor: '#8b8f98' }, { nome: 'Bronze', cor: '#cd7f32' }, { nome: 'Prata', cor: '#c0c7d1' }, { nome: 'Ouro', cor: '#f5c542' },
  { nome: 'Platina', cor: '#4fd1c5' }, { nome: 'Esmeralda', cor: '#22c55e' }, { nome: 'Diamante', cor: '#60a5fa' },
  { nome: 'Mestre', cor: '#a855f7' }, { nome: 'Grão-Mestre', cor: '#ef4444' }, { nome: 'Desafiante', cor: '#22d3ee' },
]
const DIVISOES = ['IV', 'III', 'II', 'I']
export const PASSO_MAX = 30 // 7 elos × 4 divisões (0 a 27) + 3 elos sem divisão (28 a 30)

export const eloDoPasso = (passo: number) => (passo < 28 ? Math.floor(passo / 4) : 7 + passo - 28)
export const divisaoDoPasso = (passo: number) => (passo < 28 ? DIVISOES[passo % 4] : null)
export const rotuloDoPasso = (passo: number) => `${ELOS[eloDoPasso(passo)].nome}${divisaoDoPasso(passo) ? ' ' + divisaoDoPasso(passo) : ''}`
/** Em quarenta avos do total (2,5% = 1/40): onde cada passo começa. */
const quarentaAvos = (passo: number) => (passo < 28 ? passo : passo === 28 ? 28 : passo === 29 ? 32 : 36)

/** Passo do ranking (0 a 30), só com contas inteiras para não errar nas fronteiras. */
export function passoDoRank(concluidos: number, total: number) {
  if (total <= 0) return 0
  if (concluidos * 100 >= 90 * total) return 30
  if (concluidos * 100 >= 80 * total) return 29
  if (concluidos * 100 >= 70 * total) return 28
  return Math.floor((concluidos * 40) / total)
}

export function rankDoProgresso(concluidos: number, total: number) {
  const passo = passoDoRank(concluidos, total), elo = ELOS[eloDoPasso(passo)]
  const pct = total > 0 ? Math.round((concluidos * 1000) / total) / 10 : 0
  const inicio = Math.ceil((quarentaAvos(passo) * total) / 40)
  const proximo = passo < PASSO_MAX ? { rotulo: rotuloDoPasso(passo + 1), faltam: Math.ceil((quarentaAvos(passo + 1) * total) / 40) - concluidos } : null
  const fim = passo < PASSO_MAX ? Math.ceil((quarentaAvos(passo + 1) * total) / 40) : concluidos
  return {
    classificado: total > 0, passo, rotulo: rotuloDoPasso(passo), elo: elo.nome, cor: elo.cor, divisao: divisaoDoPasso(passo),
    concluidos, total, pct, proximo, progresso: proximo && fim > inicio ? Math.max(0, Math.min(100, Math.round(((concluidos - inicio) / (fim - inicio)) * 100))) : 100,
  }
}

/** O que celebrar: um passo do ranking acima do maior já comemorado, ou um título novo. Cair de rank e voltar não gera aviso. */
export function promocoes(p: { passo: number; rankVisto: number; nivel: number; nivelVisto: number }) {
  return {
    rank: p.passo > p.rankVisto ? rotuloDoPasso(p.passo) : null,
    titulo: indiceTitulo(p.nivel) > indiceTitulo(p.nivelVisto) ? tituloDoNivel(p.nivel) : null,
  }
}
