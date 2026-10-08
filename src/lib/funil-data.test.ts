import { it, expect, vi } from 'vitest'

const tabelas: Record<string, any[]> = {
  profiles: [{ id: 'adm', onboarded: true, created_at: '2026-09-01T00:00:00Z' }, { id: 'a', onboarded: true, created_at: '2026-10-05T00:00:00Z' }, { id: 'b', onboarded: false, created_at: '2026-09-10T00:00:00Z' }],
  admins: [{ uid: 'adm' }],
  daily_stats: [{ user_id: 'a', data: '2026-10-05' }, { user_id: 'a', data: '2026-10-06' }, { user_id: 'adm', data: '2026-10-01' }],
  topics: [{ id: 't1', user_id: 'a' }, { id: 't2', user_id: 'adm' }],
}
vi.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: () => ({
  from: (t: string) => {
    let linhas = tabelas[t] ?? []
    const q: any = {
      select: () => q, order: () => q,
      eq: (c: string, v: string) => { linhas = linhas.filter(l => l[c] === v); return q },
      limit: (n: number) => Promise.resolve({ data: linhas.slice(0, n), error: null }),
      range: (de: number, ate: number) => Promise.resolve({ data: linhas.slice(de, ate + 1), error: null }),
      then: (r: (v: unknown) => void) => r({ data: linhas, error: null }),
    }
    return q
  },
}) }))
import { carregarFunil } from './funil-data'

it('lê todas as contas com a chave de serviço e monta o funil sem a administradora', async () => {
  const f = await carregarFunil('2026-10-08')
  expect(f?.geral.total).toBe(2)
  expect(f?.geral.etapas.map(e => e.n)).toEqual([2, 1, 1, 1, 1]) // "a" fez tudo; "b" só criou a conta
  expect(f?.semana.total).toBe(1) // só "a" foi criada nos últimos 7 dias
})
