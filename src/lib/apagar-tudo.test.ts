import { it, expect, vi, beforeEach } from 'vitest'
const h = vi.hoisted(() => ({ rpcs: [] as string[], removidos: [] as string[][], redirects: [] as string[], erro: null as any }))
vi.mock('@/lib/supabase/server', () => ({ supabaseServer: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
  rpc: async (n: string) => { h.rpcs.push(n); return { data: { apagados: 10 }, error: h.erro } },
  storage: { from: () => ({
    list: async (p: string) => ({ data: p === 'u1' ? [{ name: 'prova1' }, { name: 'banco' }] : [{ name: 'a.png' }, { name: 'b.png' }] }),
    remove: async (ps: string[]) => { h.removidos.push(ps); return {} },
  }) },
}) }))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({ redirect: (u: string) => { h.redirects.push(u); throw new Error('REDIRECT') } }))
import { apagarTudo } from './config'
const fd = (c: string) => { const f = new FormData(); f.set('confirmacao', c); return f }
beforeEach(() => { h.rpcs = []; h.removidos = []; h.redirects = []; h.erro = null })

it('sem digitar APAGAR TUDO, nada é apagado', async () => {
  await expect(apagarTudo(fd('apagar'))).rejects.toThrow('REDIRECT')
  expect(h.rpcs).toEqual([]); expect(h.removidos).toEqual([]); expect(decodeURIComponent(h.redirects[0])).toContain('Nada foi apagado')
})
it('confirmado: apaga tudo numa chamada, tira as figuras de todas as pastas da pessoa e abre o assistente inicial', async () => {
  await expect(apagarTudo(fd('  apagar   tudo '))).rejects.toThrow('REDIRECT')
  expect(h.rpcs).toEqual(['apagar_tudo'])
  expect(h.removidos).toEqual([['u1/prova1/a.png', 'u1/prova1/b.png'], ['u1/banco/a.png', 'u1/banco/b.png']])
  expect(h.redirects.at(-1)).toBe('/onboarding')
})
it('se o banco falhar, não mexe nas figuras e avisa que nada foi apagado', async () => {
  h.erro = { message: 'Could not find the function public.apagar_tudo' }
  await expect(apagarTudo(fd('APAGAR TUDO'))).rejects.toThrow('REDIRECT')
  expect(h.removidos).toEqual([]); expect(decodeURIComponent(h.redirects[0])).toContain('0036_apagar_tudo.sql')
})
