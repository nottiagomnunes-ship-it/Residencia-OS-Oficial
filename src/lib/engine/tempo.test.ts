import { it, expect, describe } from 'vitest'
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

import { escolherAdiantar, semanaAAvisar, planoDesatualizado } from './tempo'
describe('adiantar', () => {
  it('traz o que cabe no tempo que sobra, na ordem do plano', () => {
    expect(escolherAdiantar([t(60), t(30), t(90)], 100)).toEqual([t(60), t(30)])
    expect(escolherAdiantar([t(60), t(30)], 20)).toEqual([])            // menos de 30 min livres: não vale
    expect(escolherAdiantar([t(120), t(30)], 90)).toEqual([])           // a primeira não cabe: não pula para a menor
  })
})
describe('lembrete da semana', () => {
  it('de sexta a domingo lembra a próxima; de segunda a quinta, a atual', () => {
    expect(semanaAAvisar('2026-10-07', {})).toBe('2026-10-05')   // quarta
    expect(semanaAAvisar('2026-10-09', {})).toBe('2026-10-12')   // sexta
    expect(semanaAAvisar('2026-10-10', {})).toBe('2026-10-12')   // sábado
    expect(semanaAAvisar('2026-10-11', {})).toBe('2026-10-12')   // domingo
  })
  it('não lembra se a semana já tem algum dia informado (de hoje em diante)', () => {
    expect(semanaAAvisar('2026-10-07', { '2026-10-08': 60 })).toBeNull()
    expect(semanaAAvisar('2026-10-09', { '2026-10-14': 0 })).toBeNull()        // "sem tempo" também é informar
    expect(semanaAAvisar('2026-10-07', { '2026-10-05': 120 })).toBe('2026-10-05') // só um dia que já passou não conta
    expect(semanaAAvisar('2026-10-09', { '2026-10-09': 60 })).toBe('2026-10-12')  // informar a semana que acaba não livra a próxima
  })
})
describe('plano desatualizado', () => {
  it('só quando o tempo mudou depois da última geração (formatos de data diferentes são comparados como datas)', () => {
    expect(planoDesatualizado(null, null)).toBe(false)
    expect(planoDesatualizado('2026-10-05T10:00:00.000Z', null)).toBe(true)
    expect(planoDesatualizado('2026-10-05T10:00:00.000Z', '2026-10-05T09:00:00+00:00')).toBe(true)
    expect(planoDesatualizado('2026-10-05T10:00:00.000Z', '2026-10-05T10:00:01+00:00')).toBe(false)
    expect(planoDesatualizado('2026-10-05T10:00:00.000Z', '2026-10-05T07:00:00-03:00')).toBe(false)   // 07:00-03:00 = 10:00Z (igual, não é depois)
  })
})
