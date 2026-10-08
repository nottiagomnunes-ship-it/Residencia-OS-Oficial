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

