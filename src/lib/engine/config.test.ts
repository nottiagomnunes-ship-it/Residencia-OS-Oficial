import { it, expect } from 'vitest'
import { CONFIG_PADRAO as P, parseIntervalos } from './config'
import { hhmmParaMin } from './compromissos'

it('valores padrão das configurações são válidos e coerentes', () => {
  expect(parseIntervalos(P.review_intervals.join(', '))).toEqual(P.review_intervals)
  expect(P.available_weekdays.length).toBeGreaterThan(0); expect(P.available_weekdays.every(d => d >= 0 && d <= 6)).toBe(true)
  expect(P.limite_foco).toBeGreaterThanOrEqual(1); expect(P.limite_foco).toBeLessThanOrEqual(100)
  expect(P.min_questoes).toBeGreaterThanOrEqual(1); expect(P.min_questoes).toBeLessThanOrEqual(100)
  expect(P.daily_minutes).toBeGreaterThanOrEqual(60); expect(P.daily_minutes).toBeLessThanOrEqual(960)
  expect(P.folga_min).toBeGreaterThanOrEqual(0); expect(P.folga_min).toBeLessThanOrEqual(180)
  expect(hhmmParaMin(P.janela_ini)).toBeLessThan(hhmmParaMin(P.janela_fim))
  expect(P.exam_date).toBeNull(); expect(P.adaptive_reviews).toBe(true)
})
