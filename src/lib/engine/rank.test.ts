import { describe, it, expect } from 'vitest'
import { TITULOS, tituloDoNivel, proximoTitulo, passoDoRank, rankDoProgresso, rotuloDoPasso, promocoes } from './rank'

describe('títulos por nível', () => {
  it('troca de título nos níveis certos', () => {
    expect([1, 2, 3, 5, 6, 9, 10, 29, 30, 99, 100, 150].map(tituloDoNivel))
      .toEqual(['Calouro', 'Calouro', 'Acadêmico', 'Acadêmico', 'Interno', 'Interno', 'Plantonista', 'Chefe de Plantão', 'Residente', 'Mestre', 'Professor Titular', 'Professor Titular'])
  })
  it('próximo título, e nenhum no topo', () => { expect(proximoTitulo(1)).toEqual({ desde: 3, nome: 'Acadêmico' }); expect(proximoTitulo(100)).toBeNull(); expect(TITULOS[0].desde).toBe(1) })
})

describe('ranking por assuntos concluídos', () => {
  it('cada 10% é um elo; 7 elos têm 4 divisões de 2,5%', () => {
    expect(rotuloDoPasso(passoDoRank(0, 100))).toBe('Ferro IV')
    expect(rotuloDoPasso(passoDoRank(2, 100))).toBe('Ferro IV')
    expect(rotuloDoPasso(passoDoRank(3, 100))).toBe('Ferro III')      // 3% passou de 2,5%
    expect(rotuloDoPasso(passoDoRank(10, 100))).toBe('Bronze IV')
    expect(rotuloDoPasso(passoDoRank(25, 100))).toBe('Prata II')      // metade do elo Prata (20 a 30%)
    expect(rotuloDoPasso(passoDoRank(69, 100))).toBe('Diamante I')
  })
  it('Mestre, Grão-Mestre e Desafiante não têm divisões', () => {
    expect([70, 79, 80, 89, 90, 100].map(n => rotuloDoPasso(passoDoRank(n, 100)))).toEqual(['Mestre', 'Mestre', 'Grão-Mestre', 'Grão-Mestre', 'Desafiante', 'Desafiante'])
  })
  it('as fronteiras são exatas com qualquer total (sem erro de arredondamento)', () => {
    expect(passoDoRank(3, 120)).toBe(1)    // exatamente 2,5%
    expect(passoDoRank(2, 120)).toBe(0)
    expect(passoDoRank(7, 10)).toBe(28)    // exatamente 70%
    expect(passoDoRank(69, 99)).toBe(27)   // 69,69%: ainda Diamante I
  })
  it('quantos assuntos faltam para o próximo rank', () => {
    const r = rankDoProgresso(47, 110)     // 42,7%
    expect(r).toMatchObject({ rotulo: 'Platina III', elo: 'Platina', pct: 42.7, classificado: true })
    expect(r.proximo).toEqual({ rotulo: 'Platina II', faltam: 3 })
    expect(rankDoProgresso(69, 100).proximo).toEqual({ rotulo: 'Mestre', faltam: 1 })
    expect(rankDoProgresso(79, 100).proximo).toEqual({ rotulo: 'Grão-Mestre', faltam: 1 })
  })
  it('barra de progresso dentro do passo e topo do ranking', () => {
    expect(rankDoProgresso(0, 100).progresso).toBe(0)
    expect(rankDoProgresso(1, 100).progresso).toBe(33)   // Ferro IV vai de 0 a 3 assuntos (2,5% arredondado para cima)
    const topo = rankDoProgresso(95, 100); expect(topo).toMatchObject({ rotulo: 'Desafiante', proximo: null, progresso: 100 })
  })
  it('sem assuntos não há classificação', () => { expect(rankDoProgresso(0, 0)).toMatchObject({ classificado: false, passo: 0, pct: 0 }) })
  it('o rank nunca passa de 100% nem cai ao concluir mais', () => {
    let ant = -1; for (let n = 0; n <= 80; n++) { const p = passoDoRank(n, 80); expect(p).toBeGreaterThanOrEqual(ant); expect(p).toBeLessThanOrEqual(30); ant = p }
  })
})

describe('promoções a celebrar', () => {
  it('só celebra rank acima do maior já comemorado', () => {
    expect(promocoes({ passo: 5, rankVisto: 5, nivel: 1, nivelVisto: 1 })).toEqual({ rank: null, titulo: null })
    expect(promocoes({ passo: 6, rankVisto: 5, nivel: 1, nivelVisto: 1 }).rank).toBe('Bronze II')
    expect(promocoes({ passo: 3, rankVisto: 5, nivel: 1, nivelVisto: 1 }).rank).toBeNull()   // caiu e voltou: sem aviso
  })
  it('celebra título novo, não cada nível', () => {
    expect(promocoes({ passo: 0, rankVisto: 0, nivel: 2, nivelVisto: 1 }).titulo).toBeNull()
    expect(promocoes({ passo: 0, rankVisto: 0, nivel: 3, nivelVisto: 2 }).titulo).toBe('Acadêmico')
    expect(promocoes({ passo: 0, rankVisto: 0, nivel: 10, nivelVisto: 1 }).titulo).toBe('Plantonista')
  })
})
