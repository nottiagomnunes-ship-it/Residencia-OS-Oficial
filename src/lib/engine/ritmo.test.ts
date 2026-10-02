import { describe, it, expect } from 'vitest'
import { calcularRitmo } from './ritmo'
import { reservaRetaFinal } from './schedule'
import { addDays } from './review'

const hoje = '2026-10-05', prova = '2026-12-15'   // 71 dias: a reserva da reta final é 14, então o estudo novo vai até 30/11
const dias = (n: number, d = hoje) => addDays(d, -n)
// n assuntos concluídos distribuídos nos últimos 28 dias
const feitos = (n: number) => Array.from({ length: n }, (_, k) => addDays(hoje, -(k % 28)))
const calc = (o: Partial<Parameters<typeof calcularRitmo>[0]> = {}) => calcularRitmo({ hoje, prova, total: 100, concluidos: 40, primeiraConclusao: dias(40), concluidosRecentes: feitos(12), ...o })

describe('reserva da reta final (a mesma do gerador)', () => {
  it('20% do período, no máximo 21 dias', () => { expect([4, 10, 71, 105, 200].map(reservaRetaFinal)).toEqual([0, 2, 14, 21, 21]) })
})

describe('estados sem conta', () => {
  it('sem assuntos, sem prova, prova passada e tudo concluído', () => {
    expect(calc({ total: 0, concluidos: 0 }).estado).toBe('sem_assuntos')
    expect(calc({ prova: null }).estado).toBe('sem_prova')
    expect(calc({ prova: '2026-10-05' }).estado).toBe('prova_passou')     // a prova é hoje
    expect(calc({ prova: '2026-09-01' }).estado).toBe('prova_passou')
    expect(calc({ concluidos: 100 })).toMatchObject({ estado: 'concluido', restantes: 0 })
  })
})

describe('prazo e ritmo necessário', () => {
  it('o prazo é o fim do estudo novo (antes da reta final) e o ritmo necessário é por semana', () => {
    const r = calc()
    expect(r).toMatchObject({ estado: 'ok', restantes: 60, diasAteProva: 71, prazo: '2026-11-30' })
    expect(r.necessario).toBeCloseTo(60 / (57 / 7), 5)        // 57 dias até o prazo: 7,37 assuntos por semana
  })
  it('perto da prova o prazo nunca fica no passado', () => {
    expect(calc({ prova: '2026-10-06' }).prazo).toBe('2026-10-05')   // sobra 1 dia
  })
})

describe('status do ritmo', () => {
  it('atrasado: 12 assuntos em 28 dias (3 por semana) contra 7,4 necessários', () => {
    const r = calc()
    expect(r.atual).toBeCloseTo(3, 5); expect(r.status).toBe('atrasado')
    expect(r.projecao).toBe(addDays(hoje, Math.ceil(60 / (3 / 7))))      // 140 dias
    expect(r.margemDias).toBeLessThan(0); expect(r.faltaPorSemana).toBeCloseTo(60 / (57 / 7) - 3, 5)
  })
  it('adiantado: acima de 115% do necessário termina antes do prazo', () => {
    const r = calc({ concluidos: 60, concluidosRecentes: feitos(28) })    // 28 em 28 dias = 7/semana contra 4,9
    expect(r.status).toBe('adiantado'); expect(r.margemDias).toBeGreaterThan(0); expect(r.faltaPorSemana).toBe(0)
  })
  it('no ritmo: entre 90% e 115%', () => {
    const r = calc({ concluidos: 40, concluidosRecentes: feitos(29) })    // ~7,25/semana contra 7,37
    expect(r.status).toBe('no_ritmo')
  })
  it('um pouco atrás: entre 60% e 90%', () => {
    expect(calc({ concluidosRecentes: feitos(22) }).status).toBe('um_pouco_atras')   // 5,5/semana = 75% do necessário
  })
  it('as fronteiras: exatamente 90% é "no ritmo" e logo abaixo é "um pouco atrás"', () => {
    const nec = 60 / (57 / 7)
    const quase = (razao: number) => { const n = Math.round((nec * razao) * 4); return calc({ concluidosRecentes: feitos(n) }) }
    expect(quase(1.0).status).toBe('no_ritmo'); expect(quase(0.5).status).toBe('atrasado')
  })
})

describe('histórico curto ou parado', () => {
  it('menos de 7 dias de histórico ou nenhuma conclusão: só mostra o ritmo necessário', () => {
    for (const o of [{ primeiraConclusao: dias(5) }, { primeiraConclusao: null, concluidosRecentes: [] as string[] }]) {
      const r = calc(o); expect(r).toMatchObject({ status: 'sem_historico', atual: null, projecao: null }); expect(r.necessario).toBeGreaterThan(0)
    }
  })
  it('com exatamente 7 dias de histórico já mede (janela de 7 dias, não de 28)', () => {
    const r = calc({ primeiraConclusao: dias(6), concluidosRecentes: feitos(7).filter((_, k) => k < 7) })
    expect(r.status).not.toBe('sem_historico'); expect(r.atual).toBeCloseTo(7, 5)        // 7 assuntos em 7 dias = 7 por semana
  })
  it('quem começou há 10 dias não tem o ritmo diluído numa janela de 28', () => {
    const r = calc({ primeiraConclusao: dias(9), concluidosRecentes: feitos(5) })          // 5 assuntos em 10 dias
    expect(r.atual).toBeCloseTo(5 / (10 / 7), 5)
  })
  it('conclusões antigas (fora da janela) não contam: ritmo zero e sem projeção', () => {
    const r = calc({ primeiraConclusao: dias(90), concluidosRecentes: [] })
    expect(r).toMatchObject({ status: 'atrasado', atual: 0, projecao: null, margemDias: null })
    expect(r.faltaPorSemana).toBeCloseTo(r.necessario!, 5)
  })
})

describe('plano atual', () => {
  it('repassa quantos assuntos têm e não têm data no plano', () => { expect(calc({ semData: 4, comData: 50 })).toMatchObject({ semData: 4, comData: 50 }) })
})
