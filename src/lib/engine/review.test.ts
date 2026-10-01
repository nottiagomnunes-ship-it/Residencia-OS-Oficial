import { describe, it, expect } from 'vitest'
import { addDays, diffDays, generateReviews, intervalFactor, nextDueAfterReview, priorityScore, levelFor } from './review'

describe('datas', () => {
  it('vira o mês e o ano', () => { expect(addDays('2026-12-30', 3)).toBe('2027-01-02'); expect(diffDays('2026-10-01', '2026-10-08')).toBe(7) })
})
describe('generateReviews', () => {
  it('gera D1/D7/D30/D60 a partir de 01/10', () => {
    expect(generateReviews('2026-10-01', [1, 7, 30, 60]).map(r => r.due_date)).toEqual(['2026-10-02', '2026-10-08', '2026-10-31', '2026-11-30'])
  })
  it('aceita intervalos personalizados, ordena e ignora inválidos', () => {
    expect(generateReviews('2026-10-01', [14, 3, 3, 0, -2]).map(r => [r.numero, r.interval_days])).toEqual([[1, 3], [2, 14]])
  })
})
describe('ajuste adaptativo', () => {
  it('fator por desempenho e por dificuldade', () => {
    expect(intervalFactor(50, null)).toBe(0.5); expect(intervalFactor(70, null)).toBe(1); expect(intervalFactor(90, null)).toBe(1.3)
    expect(intervalFactor(null, 3)).toBe(0.5); expect(intervalFactor(null, 1)).toBe(1.3); expect(intervalFactor(null, null)).toBe(1)
  })
  it('no prazo e com desempenho médio, mantém a data original', () => { expect(nextDueAfterReview('2026-10-02', 1, 7, 70, 2)).toBe('2026-10-08') })
  it('desempenho ruim encurta e bom alonga', () => {
    expect(nextDueAfterReview('2026-10-02', 1, 7, 50, null)).toBe('2026-10-05')
    expect(nextDueAfterReview('2026-10-02', 1, 7, 90, null)).toBe('2026-10-10')
  })
  it('nunca agenda para o mesmo dia', () => { expect(nextDueAfterReview('2026-10-02', 6, 7, 10, null)).toBe('2026-10-03') })
})
describe('priorityScore', () => {
  it('atraso e assunto fraco sobem na fila', () => {
    const base = { acerto: 80, peso: 3, numero: 2 }
    expect(priorityScore({ ...base, diasAtraso: 4 })).toBeGreaterThan(priorityScore({ ...base, diasAtraso: 0 }))
    expect(priorityScore({ ...base, diasAtraso: 0, acerto: 55 })).toBeGreaterThan(priorityScore({ ...base, diasAtraso: 0 }))
  })
  it('trata acerto desconhecido como neutro (70%)', () => {
    expect(priorityScore({ diasAtraso: 0, acerto: null, peso: 3, numero: 2 })).toBe(priorityScore({ diasAtraso: 0, acerto: 70, peso: 3, numero: 2 }))
  })
})
it('nível sobe a cada 500 XP', () => { expect(levelFor(0)).toBe(1); expect(levelFor(499)).toBe(1); expect(levelFor(500)).toBe(2) })
