import { describe, it, expect } from 'vitest'
import { pct, agregarPor, prioridadeAssunto, recomendacoes, serieSemanal, type SetQ } from './desempenho'

const s = (o: Partial<SetQ>): SetQ => ({ discipline_id: 'D', topic_id: 'T', total: 10, acertos: 5, realizado_em: '2026-09-29', ...o })
const base = { nome: 'Hipertensão', total: 50, acertos: 29, revisoesAtrasadas: 0, errosConteudo: 0 }

it('pct arredonda e trata zero', () => { expect(pct(42, 50)).toBe(84); expect(pct(0, 0)).toBeNull() })
it('agrega por assunto ignorando sem vínculo', () => {
  const m = agregarPor([s({ total: 10, acertos: 8 }), s({ total: 20, acertos: 10 }), s({ topic_id: null })], 'topic_id')
  expect(m.get('T')).toEqual({ total: 30, acertos: 18 }); expect(m.size).toBe(1)
})
describe('prioridadeAssunto', () => {
  it('58% + revisão atrasada = alta', () => {
    const r = prioridadeAssunto({ ...base, revisoesAtrasadas: 1 })
    expect(r.nivel).toBe('alta'); expect(r.frase).toBe('Hipertensão: 58% de acerto, 21 questões erradas, revisão atrasada.')
  })
  it('um sinal só = média; nenhum = baixa', () => {
    expect(prioridadeAssunto({ ...base, total: 20, acertos: 19, revisoesAtrasadas: 2 }).nivel).toBe('media')
    expect(prioridadeAssunto({ ...base, total: 20, acertos: 19 }).nivel).toBe('baixa')
  })
  it('amostra pequena não conta como desempenho baixo', () => { expect(prioridadeAssunto({ ...base, total: 5, acertos: 1 }).razoes).toHaveLength(0) })
  it('erros por falta de conteúdo pesam a partir de 3', () => { expect(prioridadeAssunto({ ...base, total: 0, acertos: 0, errosConteudo: 3 }).nivel).toBe('media') })
})
describe('recomendacoes', () => {
  const d = [{ id: 'D', nome: 'Cardiologia' }]
  it('alerta com acerto < 65% nas últimas questões', () => {
    const r = recomendacoes([s({ total: 50, acertos: 30 })], d)
    expect(r[0].acerto).toBe(60); expect(r[0].texto).toMatch(/abaixo de 65% em Cardiologia nas últimas 50 questões/)
  })
  it('só considera as sessões mais recentes', () => {
    const sets = [s({ total: 50, acertos: 45, realizado_em: '2026-09-29' }), s({ total: 50, acertos: 10, realizado_em: '2026-09-01' })]
    expect(recomendacoes(sets, d)).toHaveLength(0)
  })
  it('exige amostra mínima', () => { expect(recomendacoes([s({ total: 20, acertos: 5 })], d)).toHaveLength(0) })
})
it('série semanal agrupa de segunda a domingo', () => {
  const r = serieSemanal([s({ total: 40, acertos: 30, realizado_em: '2026-09-29' }), s({ total: 10, acertos: 5, realizado_em: '2026-09-20' })], [{ data: '2026-09-30', minutos: 90 }], '2026-09-30', 2)
  expect(r).toHaveLength(2); expect(r[1]).toEqual({ semana: '28/09', questoes: 40, acerto: 75, horas: 1.5 }); expect(r[0].questoes).toBe(10)
})
