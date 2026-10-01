import { it, expect } from 'vitest'
import { janelaDaMeta, progressoMeta } from './metas'
import { resumoSimulados, xpSimulado } from './simulados'

it('janelas de dia, semana (seg–dom) e mês', () => {
  expect(janelaDaMeta('dia', '2026-09-30')).toEqual({ inicio: '2026-09-30', fim: '2026-09-30' })
  expect(janelaDaMeta('semana', '2026-09-30')).toEqual({ inicio: '2026-09-28', fim: '2026-10-04' })
  expect(janelaDaMeta('mes', '2026-09-30')).toEqual({ inicio: '2026-09-01', fim: '2026-09-30' })
})
it('progresso da meta', () => { expect(progressoMeta(45, 60)).toBe(75); expect(progressoMeta(70, 60)).toBe(117); expect(progressoMeta(5, 0)).toBe(0) })
it('resumo dos simulados: ordem, variação, média e melhor', () => {
  const r = resumoSimulados([{ id: 'b', nome: 'B', data: '2026-09-20', total: 100, acertos: 70 }, { id: 'a', nome: 'A', data: '2026-09-05', total: 100, acertos: 60 }])
  expect(r.itens.map(i => i.nome)).toEqual(['A', 'B']); expect(r.itens[0].variacao).toBeNull(); expect(r.itens[1].variacao).toBe(10)
  expect(r.media).toBe(65); expect(r.melhor).toBe(70)
})
it('resumo vazio e XP do simulado', () => { expect(resumoSimulados([])).toEqual({ itens: [], media: null, melhor: null }); expect(xpSimulado(100)).toBe(40) })
