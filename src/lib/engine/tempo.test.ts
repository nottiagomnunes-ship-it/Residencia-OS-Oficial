import { it, expect } from 'vitest'
import { formatarMinutos, capacidadeDoDia, dividirPorTempo, diasDaSemana } from './tempo'

it('formata o tempo', () => { expect([0, 30, 60, 90, 120, 240].map(formatarMinutos)).toEqual(['Sem tempo', '30 min', '1 h', '1 h 30', '2 h', '4 h']) })
it('tempo do dia: o informado vale; sem informação usa o padrão nos dias disponíveis', () => {
  const seg = '2026-10-05', dom = '2026-10-11'
  expect(capacidadeDoDia(seg, {}, 120, [1, 2, 3, 4, 5])).toEqual({ minutos: 120, informado: false })
  expect(capacidadeDoDia(dom, {}, 120, [1, 2, 3, 4, 5])).toEqual({ minutos: 0, informado: false })
  expect(capacidadeDoDia(dom, { [dom]: 60 }, 120, [1, 2, 3, 4, 5])).toEqual({ minutos: 60, informado: true })
  expect(capacidadeDoDia(seg, { [seg]: 0 }, 120, [1])).toEqual({ minutos: 0, informado: true }) // "sem tempo" informado é respeitado
})
const t = (d: number | null) => ({ duracao_min: d })
it('divide pelo tempo, na ordem de prioridade', () => {
  const r = dividirPorTempo([t(30), t(60), t(45)], 100)
  expect(r.cabem).toEqual([t(30), t(60)]); expect(r.sobram).toEqual([t(45)]); expect(r.usado).toBe(90); expect(r.maiorQueOTempo).toBe(false)
})
it('ao primeiro item que não cabe, o resto fica para depois (não pula para tarefas menores)', () => {
  expect(dividirPorTempo([t(60), t(30), t(15)], 80).cabem).toEqual([t(60)])
  expect(dividirPorTempo([t(60), t(60), t(15)], 80).sobram).toEqual([t(60), t(15)])
})
it('se nada cabe, mostra a primeira tarefa avisando; sem tempo, nada é cobrado', () => {
  const r = dividirPorTempo([t(60), t(20)], 40); expect(r).toMatchObject({ cabem: [t(60)], sobram: [t(20)], usado: 60, maiorQueOTempo: true })
  expect(dividirPorTempo([t(30)], 0)).toMatchObject({ cabem: [], sobram: [t(30)], maiorQueOTempo: false })
})
it('tarefa sem duração conta 30 minutos', () => { expect(dividirPorTempo([t(null), t(null)], 60).cabem).toHaveLength(2) })
it('os 7 dias da semana', () => { expect(diasDaSemana('2026-10-05')).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']) })
