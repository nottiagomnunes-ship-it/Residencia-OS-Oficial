import { it, expect } from 'vitest'
import { partesBR } from './dates'

it('converte um instante para data e minutos de Brasília (UTC−3)', () => {
  expect(partesBR(new Date('2026-10-01T15:45:00Z'))).toEqual({ hoje: '2026-10-01', minutos: 12 * 60 + 45 })
  expect(partesBR(new Date('2026-10-01T03:30:00Z'))).toEqual({ hoje: '2026-10-01', minutos: 30 })      // 00:30 em Brasília
  expect(partesBR(new Date('2026-10-01T02:30:00Z'))).toEqual({ hoje: '2026-09-30', minutos: 23 * 60 + 30 }) // 23:30 do dia anterior
})
