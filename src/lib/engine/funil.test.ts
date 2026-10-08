import { it, expect } from 'vitest'
import { montarFunil, diasAtras } from './funil'

const p = (id: string, onboarded = true, created_at = '2026-10-01T10:00:00Z') => ({ id, onboarded, created_at })
const dias = (o: Record<string, string[]>) => new Map(Object.entries(o).map(([k, v]) => [k, new Set(v)]))

it('funil: cada etapa conta quem chegou nela; a administradora fica de fora', () => {
  const f = montarFunil({
    perfis: [p('adm'), p('a'), p('b'), p('c'), p('d', false)],
    admins: new Set(['adm']), comPlano: new Set(['adm', 'a', 'b', 'c']),
    diasAtivos: dias({ adm: ['2026-10-01', '2026-10-02'], a: ['2026-10-01', '2026-10-03'], b: ['2026-10-02'] }),
  })
  expect(f.total).toBe(4)
  expect(f.etapas.map(e => e.n)).toEqual([4, 3, 3, 2, 1])
  expect(f.etapas.map(e => e.pctTotal)).toEqual([100, 75, 75, 50, 25])
  expect(f.etapas.map(e => e.pctAnterior)).toEqual([null, 75, 100, 67, 50])
})
it('recorte "últimos 7 dias" e conta vazia', () => {
  const f = montarFunil({ perfis: [p('a', true, '2026-09-01T00:00:00Z'), p('b', true, '2026-10-06T00:00:00Z')], admins: new Set(), comPlano: new Set(), diasAtivos: new Map(), desde: diasAtras('2026-10-08', 7) })
  expect(f.total).toBe(1)
  expect(montarFunil({ perfis: [], admins: new Set(), comPlano: new Set(), diasAtivos: new Map() }).etapas[0]).toMatchObject({ n: 0, pctTotal: null })
  expect(diasAtras('2026-10-08', 7)).toBe('2026-10-01')
})

import { vi } from 'vitest'
vi.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: () => { throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada') } }))
it('sem a chave de serviço, o funil devolve null (a página mostra o aviso, sem quebrar)', async () => {
  const { carregarFunil } = await import('@/lib/funil-data')
  expect(await carregarFunil('2026-10-08')).toBeNull()
})
