import { it, expect } from 'vitest'
import { CRONOGRAMA_PADRAO } from './cronograma-padrao'
import { parseCronograma } from './importar'

it('o cronograma pronto é lido por inteiro, sem avisos nem assuntos perdidos', () => {
  const { itens, avisos } = parseCronograma(CRONOGRAMA_PADRAO, '2026-10-08')
  const linhas = CRONOGRAMA_PADRAO.split('\n').filter(l => l.trim() && !l.startsWith('#'))
  expect(avisos).toEqual([])
  expect(itens.length).toBe(linhas.length) // nenhum assunto repetido ou ignorado
  expect(itens.length).toBeGreaterThan(190)
  expect(new Set(itens.map(i => i.grupo)).size).toBe(66)
  expect(itens.every(i => i.disciplina && i.grupo && !i.data)).toBe(true) // sem datas fixas: o gerador distribui pelo tempo de cada um
  expect(itens[0]).toMatchObject({ disciplina: 'Pediatria', nome: 'Imunizações', grupo: 'Semana 1' })
})

import { ajustarAoPrazo } from './cronograma-padrao'
const semanas = (t: string) => new Set(parseCronograma(t, '2026-10-12').itens.map(i => i.grupo)).size
it('ajusta ao prazo: junta semanas quando a prova é antes, sem perder nem repetir assuntos', () => {
  expect(ajustarAoPrazo(CRONOGRAMA_PADRAO, '2026-10-12', null)).toBe(CRONOGRAMA_PADRAO)
  expect(ajustarAoPrazo(CRONOGRAMA_PADRAO, '2026-10-12', '2028-06-01')).toBe(CRONOGRAMA_PADRAO) // tempo de sobra
  expect(ajustarAoPrazo(CRONOGRAMA_PADRAO, '2026-10-12', '2026-09-01')).toBe(CRONOGRAMA_PADRAO) // data já passou: não mexe
  const umAno = ajustarAoPrazo(CRONOGRAMA_PADRAO, '2026-10-12', '2027-10-12') // 52 semanas - 4 de folga = 48: junta de 2 em 2
  expect(semanas(umAno)).toBe(33)
  const seisMeses = ajustarAoPrazo(CRONOGRAMA_PADRAO, '2026-10-12', '2027-04-12') // 26 - 4 = 22: junta de 3 em 3
  expect(semanas(seisMeses)).toBe(22)
  for (const t of [umAno, seisMeses]) {
    const { itens, avisos } = parseCronograma(t, '2026-10-12')
    expect(avisos).toEqual([]); expect(itens).toHaveLength(parseCronograma(CRONOGRAMA_PADRAO, '2026-10-12').itens.length)
    expect(itens[0].nome).toBe('Imunizações') // a ordem continua a mesma
  }
  expect(semanas(ajustarAoPrazo(CRONOGRAMA_PADRAO, '2026-10-12', '2026-10-20'))).toBe(1) // prova em dias: tudo numa semana só
})
