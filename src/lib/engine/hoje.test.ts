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
