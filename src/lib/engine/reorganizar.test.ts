import { describe, it, expect } from 'vitest'
import { reorganizarAtrasadas, type ItemPlano } from './reorganizar'

const it_ = (id: string, tipo: string, data: string, d: number | null = 30, ordem: number | null = null): ItemPlano => ({ id, tipo, data, duracao_min: d, ordem_dia: ordem })
const hoje = '2026-10-05'   // segunda
const cap = (m: number) => () => m
const soma = (l: { duracao_min: number }[]) => l.reduce((s, x) => s + x.duracao_min, 0)

describe('reorganizar atrasadas', () => {
  it('distribui pelos próximos dias sem passar do tempo de cada um', () => {
    const atrasadas = Array.from({ length: 7 }, (_, k) => it_('a' + k, 'estudo', '2026-10-01', 60))   // 7 h de atraso
    const r = reorganizarAtrasadas({ hoje, dias: 7, atrasadas, abertos: [], capacidade: cap(120) })
    expect(r.semLugar).toHaveLength(0); expect(r.movimentos).toHaveLength(7)
    for (const d of new Set(r.movimentos.map(m => m.para))) expect(soma(r.movimentos.filter(m => m.para === d))).toBeLessThanOrEqual(120)
    expect(r.movimentos.filter(m => m.para === hoje)).toHaveLength(2)        // hoje cabem 2 h
  })
  it('conta o que o dia já tem e o que você já fez hoje', () => {
    const abertos = [it_('x', 'estudo', hoje, 60, 1), it_('y', 'questoes', '2026-10-06', 90, 1)]
    const r = reorganizarAtrasadas({ hoje, dias: 3, atrasadas: [it_('a', 'estudo', '2026-10-01', 60), it_('b', 'estudo', '2026-10-01', 60)], abertos, capacidade: cap(120), feitosHoje: 30 })
    // hoje sobram 120 - 60 - 30 (já feito) = 30 min; amanhã 120 - 90 = 30; só o dia 7 tem 120 livres, onde cabem as duas de 60
    expect(r.movimentos.map(m => [m.id, m.para])).toEqual([['a', '2026-10-07'], ['b', '2026-10-07']])
  })
  it('revisões vêm antes do estudo, e o simulado por último', () => {
    const r = reorganizarAtrasadas({ hoje, dias: 5, capacidade: cap(60), abertos: [],
      atrasadas: [it_('sim', 'simulado', '2026-09-28', 30), it_('est', 'estudo', '2026-09-29', 30), it_('rev', 'revisao', '2026-10-02', 30)] })
    expect(r.movimentos.filter(m => m.para === hoje).map(m => m.id)).toEqual(['rev', 'est'])   // 60 min: revisão e estudo; simulado vai ao dia seguinte
    expect(r.movimentos.find(m => m.id === 'sim')!.para).toBe('2026-10-06')
  })
  it('as movidas entram à frente do que o dia já tinha', () => {
    const r = reorganizarAtrasadas({ hoje, dias: 1, capacidade: cap(240), abertos: [it_('x', 'estudo', hoje, 60, 1), it_('y', 'questoes', hoje, 40, 2)], atrasadas: [it_('a', 'estudo', '2026-10-01', 30), it_('b', 'revisao', '2026-10-02', 30)] })
    expect(r.movimentos.map(m => [m.id, m.ordem_dia])).toEqual([['b', -1], ['a', 0]])   // b (revisão) vem primeiro; ambas antes da ordem 1
  })
  it('dias sem tempo são pulados, e o que não cabe em nenhum dia fica de fora', () => {
    const capacidade = (d: string) => (d === hoje ? 0 : d === '2026-10-06' ? 60 : 0)
    const r = reorganizarAtrasadas({ hoje, dias: 4, capacidade, abertos: [], atrasadas: [it_('a', 'estudo', '2026-10-01', 60), it_('b', 'estudo', '2026-10-02', 60), it_('grande', 'simulado', '2026-10-03', 240)] })
    expect(r.movimentos.map(m => [m.id, m.para])).toEqual([['a', '2026-10-06']])
    expect(r.semLugar.map(i => i.id).sort()).toEqual(['b', 'grande'])
  })
  it('sem atrasadas ou sem tempo nenhum, nada se move', () => {
    expect(reorganizarAtrasadas({ hoje, dias: 7, atrasadas: [], abertos: [], capacidade: cap(120) })).toEqual({ movimentos: [], semLugar: [] })
    const r = reorganizarAtrasadas({ hoje, dias: 7, atrasadas: [it_('a', 'estudo', '2026-10-01', 30)], abertos: [], capacidade: cap(0) })
    expect(r.movimentos).toHaveLength(0); expect(r.semLugar).toHaveLength(1)
  })
  it('tarefa sem duração conta 30 minutos', () => {
    const r = reorganizarAtrasadas({ hoje, dias: 1, capacidade: cap(60), abertos: [], atrasadas: [it_('a', 'estudo', '2026-10-01', null), it_('b', 'estudo', '2026-10-01', null), it_('c', 'estudo', '2026-10-01', null)] })
    expect(r.movimentos).toHaveLength(2); expect(r.semLugar).toHaveLength(1)
  })
})
