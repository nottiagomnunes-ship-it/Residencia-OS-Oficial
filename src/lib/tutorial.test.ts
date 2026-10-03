import { it, expect, vi } from 'vitest'
const h = vi.hoisted(() => ({ ops: [] as string[] }))
vi.mock('@/lib/supabase/server', () => ({ supabaseServer: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
  from: (t: string) => ({ update: (v: any) => ({ eq: (k: string, x: string) => ({ is: async (k2: string, x2: null) => { h.ops.push(`${t}.update(${Object.keys(v)}).eq(${k}=${x}).is(${k2}=${x2})`); return {} } }) }) }),
}) }))
import { marcarTutorialVisto } from './tutorial'
it('marca como visto só se ainda não estava (não reescreve a data)', async () => {
  await marcarTutorialVisto()
  expect(h.ops).toEqual(['profiles.update(tutorial_visto_em).eq(id=u1).is(tutorial_visto_em=null)'])
})
