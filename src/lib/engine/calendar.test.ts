import { it, expect, describe } from 'vitest'
import { weekStart, diasDaVisao, mover, statusDe, validarEdicaoTarefa } from './calendar'

it('semana começa na segunda', () => { expect(weekStart('2026-09-29')).toBe('2026-09-28'); expect(weekStart('2026-09-27')).toBe('2026-09-21') })
it('grade do mês tem semanas completas', () => {
  const d = diasDaVisao('mes', '2026-10-15')
  expect(d[0]).toBe('2026-09-28'); expect(d.length % 7).toBe(0); expect(d).toContain('2026-10-31')
})
it('navegação entre meses e semanas', () => { expect(mover('mes', '2026-01-15', -1)).toBe('2025-12-01'); expect(mover('semana', '2026-10-01', 1)).toBe('2026-10-08') })
it('status visual', () => {
  const h = '2026-09-29'
  expect(statusDe({ status: 'agendado', data: '2026-09-28' }, h)).toBe('atrasado')
  expect(statusDe({ status: 'agendado', data: '2026-09-30' }, h)).toBe('proximo')
  expect(statusDe({ status: 'agendado', data: '2026-10-05' }, h)).toBe('agendado')
  expect(statusDe({ status: 'concluido', data: '2026-09-01' }, h)).toBe('concluido')
})

it('edição de tarefa: valores válidos e hora de fim calculada', () => {
  expect(validarEdicaoTarefa({ titulo: ' DPOC ', hora: '19:30', dur: '45', qtd: '' }, false)).toEqual({ titulo: 'DPOC', hora_ini: '19:30', hora_fim: '20:15', dur: 45, qtd: null })
  expect(validarEdicaoTarefa({ titulo: 'x', hora: '19:30', dur: '', qtd: '40' }, false)).toMatchObject({ hora_fim: null, qtd: 40 })
  expect(validarEdicaoTarefa({ titulo: 'x', hora: '', dur: '30', qtd: '' }, false)).toMatchObject({ hora_ini: null, hora_fim: null })
})
it('edição de tarefa: erros', () => {
  const e = (c: Partial<{ titulo: string; hora: string; dur: string; qtd: string }>, rev = false) => validarEdicaoTarefa({ titulo: 'x', hora: '', dur: '', qtd: '', ...c }, rev)
  expect(e({ titulo: '  ' })).toHaveProperty('erro'); expect(e({ hora: '25:00' })).toHaveProperty('erro'); expect(e({ hora: '7:5' })).toHaveProperty('erro')
  expect(e({ dur: '3' })).toHaveProperty('erro'); expect(e({ dur: '30.5' })).toHaveProperty('erro'); expect(e({ qtd: '0' })).toHaveProperty('erro')
  expect(e({ hora: '23:30', dur: '45' })).toHaveProperty('erro')
  expect(e({ titulo: '' }, true)).not.toHaveProperty('erro') // revisão: o título não é editável
})
