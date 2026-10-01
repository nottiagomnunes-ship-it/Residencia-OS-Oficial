import { it, expect } from 'vitest'
import { avaliarVariavel } from './diagnostico'

it('ausente, vazia e problemas de colagem', () => {
  expect(avaliarVariavel('RESEND_API_KEY', undefined).estado).toBe('ausente')
  expect(avaliarVariavel('RESEND_API_KEY', '').detalhe).toMatch(/vazia/)
  expect(avaliarVariavel('RESEND_API_KEY', 're_abc123 ').detalhe).toMatch(/espaço/)
  expect(avaliarVariavel('RESEND_API_KEY', '"re_abc123"').detalhe).toMatch(/aspas/)
  expect(avaliarVariavel('RESEND_API_KEY', 'abc123').detalhe).toMatch(/re_/)
})
it('formato esperado de cada chave e o valor nunca aparece', () => {
  expect(avaliarVariavel('RESEND_API_KEY', 're_ABCDEFGH')).toEqual({ nome: 'RESEND_API_KEY', estado: 'ok', detalhe: 'Configurada (11 caracteres).' })
  expect(avaliarVariavel('SUPABASE_SERVICE_ROLE_KEY', 'eyJhbGciOi.xxx.yyy').estado).toBe('ok')
  expect(avaliarVariavel('SUPABASE_SERVICE_ROLE_KEY', 'sb_publishable_x').estado).toBe('atencao')
  expect(avaliarVariavel('CRON_SECRET', 'curto').estado).toBe('atencao'); expect(avaliarVariavel('CRON_SECRET', 'a'.repeat(32)).estado).toBe('ok')
  expect(JSON.stringify(avaliarVariavel('RESEND_API_KEY', 're_SEGREDO_MUITO_SECRETO'))).not.toMatch(/SEGREDO/)
})
