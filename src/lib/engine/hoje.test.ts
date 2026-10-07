import { it, expect } from 'vitest'
import { resumoHoje } from './hoje'

const H = '2026-10-05', i = (id: string, data: string) => ({ id, data })
it('separa atrasadas e de hoje e calcula o progresso com o que já foi concluído', () => {
  const r = resumoHoje([i('a', '2026-10-03'), i('b', H), i('c', H)], H, 2, new Set())
  expect(r.atrasadas.map(x => x.id)).toEqual(['a']); expect(r.deHoje.map(x => x.id)).toEqual(['b', 'c'])
  expect(r).toMatchObject({ feitas: 2, total: 4, pct: 50 })
})
it('ao concluir na tela, a tarefa sai da lista e o progresso sobe; atrasada concluída não conta no dia', () => {
  const r = resumoHoje([i('a', '2026-10-03'), i('b', H), i('c', H)], H, 2, new Set(['a', 'b']))
  expect(r.atrasadas).toEqual([]); expect(r.deHoje.map(x => x.id)).toEqual(['c']); expect(r).toMatchObject({ feitas: 3, total: 4, pct: 75 })
})
it('dia sem nada: progresso zero, sem divisão por zero', () => { expect(resumoHoje([], H, 0, new Set())).toMatchObject({ total: 0, pct: 0 }) })

import { fraseDoDia } from './hoje'
it('frase do dia: "cadastre" só sem assuntos; com plano, fala das tarefas', () => {
  expect(fraseDoDia(0, 0, false, 0)).toBe('Cadastre seus assuntos para começar o plano.')
  expect(fraseDoDia(0, 0, true, 2)).toBe('Nenhuma revisão pendente. 2 tarefas no plano de hoje.')
  expect(fraseDoDia(0, 0, true, 1)).toBe('Nenhuma revisão pendente. 1 tarefa no plano de hoje.')
  expect(fraseDoDia(0, 0, true, 0)).toBe('Nenhuma revisão pendente e nada no plano de hoje.')
  expect(fraseDoDia(3, 2, true, 5)).toBe('Você tem 3 revisões para hoje e 2 atrasadas.')
  expect(fraseDoDia(1, 0, true, 0)).toBe('Você tem 1 revisão para hoje.')
  expect(fraseDoDia(0, 1, true, 0)).toBe('Você tem 0 revisões para hoje e 1 atrasada.')
})
