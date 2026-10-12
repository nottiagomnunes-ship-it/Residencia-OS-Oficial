import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextRequest } from 'next/server'
import { apelidoSugerido, codigoValido, ordenarRanking, pctDoPlano, semanaDe, textoConvite, type LinhaRanking } from './engine/grupos'
import { conviteDoCaminho } from './engine/rotas'

const h = vi.hoisted(() => ({
  redirects: [] as string[], rpc: [] as { n: string; a: any }[], resp: {} as Record<string, { data?: any; error?: any }>,
  meus: [] as any[], meusErro: null as any, ranking: [] as any[], apagados: [] as string[], update: [] as any[], user: { id: 'u1' } as any,
}))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({ redirect: (u: string) => { h.redirects.push(u); throw new Error('REDIRECT') } }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined, delete: (n: string) => { h.apagados.push(n) } }) }))
vi.mock('@/lib/supabase/server', () => ({ supabaseServer: async () => ({
  auth: { getUser: async () => ({ data: { user: h.user } }) },
  rpc: async (n: string, a: any) => { h.rpc.push({ n, a }); return n === 'ranking_do_grupo' ? { data: h.ranking, error: null } : (h.resp[n] ?? { data: null, error: null }) },
  from: (t: string) => {
    const q: any = {
      select: () => q, eq: () => q, order: () => q, single: async () => ({ data: { nome: 'Ana Souza' } }),
      update: (d: any) => { h.update.push(d); return q },
      then: (r: (v: unknown) => void) => r(t === 'grupo_membros' ? { data: h.meus, error: h.meusErro } : { data: null, error: null }),
    }
    return q
  },
}) }))

import { criarGrupo, entrarNoGrupo, sairDoGrupo, mudarApelido } from './grupos'
import Grupos from '@/app/(app)/grupos/page'

const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f }
const rodar = (p: Promise<unknown>) => expect(p).rejects.toThrow('REDIRECT')
const L = (o: Partial<LinhaRanking>): LinhaRanking => ({ apelido: 'X', eu: false, planejado: 100, feito: 50, questoes: 0, dias: 0, ...o })

beforeEach(() => { Object.assign(h, { redirects: [], rpc: [], resp: {}, meus: [], meusErro: null, ranking: [], apagados: [], update: [], user: { id: 'u1' } }) })

describe('grupos: regras', () => {
  it('semana de segunda a domingo', () => {
    expect(semanaDe('2026-10-12')).toEqual({ ini: '2026-10-12', fim: '2026-10-18' }) // segunda
    expect(semanaDe('2026-10-18')).toEqual({ ini: '2026-10-12', fim: '2026-10-18' }) // domingo
  })
  it('% do plano: até 100, sem plano fica sem porcentagem', () => {
    expect(pctDoPlano({ planejado: 240, feito: 120 })).toBe(50); expect(pctDoPlano({ planejado: 60, feito: 90 })).toBe(100); expect(pctDoPlano({ planejado: 0, feito: 0 })).toBeNull()
  })
  it('ordena por % do plano, depois questões e dias; empates dividem a posição; sem plano no fim', () => {
    const r = ordenarRanking([
      L({ apelido: 'Bia', feito: 80 }), L({ apelido: 'Caio', planejado: 0, feito: 0, questoes: 99 }), L({ apelido: 'Ana', feito: 80 }),
      L({ apelido: 'Duda', feito: 80, questoes: 10 }), L({ apelido: 'Eu', eu: true, feito: 20 }),
    ])
    expect(r.map(x => [x.apelido, x.posicao, x.pct])).toEqual([['Duda', 1, 80], ['Ana', 2, 80], ['Bia', 2, 80], ['Eu', 4, 20], ['Caio', null, null]])
  })
  it('código: 6 letras/números sem os que confundem; apelido sugerido; convite', () => {
    expect(codigoValido(' k7q-2md ')).toBe('K7Q2MD'); expect(codigoValido('K7Q2M0')).toBeNull(); expect(codigoValido('ABC')).toBeNull()
    expect(apelidoSugerido('Ana Souza')).toBe('Ana'); expect(apelidoSugerido(null)).toBe('Eu')
    expect(textoConvite('Turma', 'K7Q2MD')).toContain('https://r1tmo.com.br/grupos?codigo=K7Q2MD')
    expect(conviteDoCaminho('/grupos', 'k7q2md')).toBe('K7Q2MD'); expect(conviteDoCaminho('/inicio', 'K7Q2MD')).toBeNull(); expect(conviteDoCaminho('/grupos', 'x')).toBeNull()
  })
})

describe('grupos: ações', () => {
  it('criar: chama a função e abre o grupo com o código', async () => {
    h.resp.criar_grupo = { data: { id: 'g1', codigo: 'K7Q2MD' } }
    await rodar(criarGrupo(fd({ nome: '  Turma  do internato ', apelido: 'Ana' })))
    expect(h.rpc[0]).toEqual({ n: 'criar_grupo', a: { p_nome: 'Turma do internato', p_apelido: 'Ana' } })
    expect(h.redirects[0]).toContain('g=g1'); expect(decodeURIComponent(h.redirects[0])).toContain('K7Q2MD')
  })
  it('criar sem nome não chama nada; limite de grupos vira aviso', async () => {
    await rodar(criarGrupo(fd({ nome: ' ', apelido: 'Ana' }))); expect(h.rpc).toEqual([]); expect(h.redirects[0]).toBe('/grupos?erro=nome')
    h.resp.criar_grupo = { data: { erro: 'limite' } }; await rodar(criarGrupo(fd({ nome: 'T', apelido: 'Ana' }))); expect(h.redirects[1]).toBe('/grupos?erro=limite')
  })
  it('entrar: normaliza o código, apaga o convite guardado; código errado mantém o código no formulário', async () => {
    h.resp.entrar_no_grupo = { data: { id: 'g1' } }
    await rodar(entrarNoGrupo(fd({ codigo: 'k7q2md', apelido: 'Ana' })))
    expect(h.rpc[0].a).toEqual({ p_codigo: 'K7Q2MD', p_apelido: 'Ana' }); expect(h.apagados).toEqual(['convite']); expect(h.redirects[0]).toContain('g=g1')
    h.resp.entrar_no_grupo = { data: { erro: 'codigo' } }
    await rodar(entrarNoGrupo(fd({ codigo: 'K7Q2MD', apelido: 'Ana' }))); expect(h.redirects[1]).toBe('/grupos?erro=codigo&codigo=K7Q2MD')
  })
  it('sem a migração: avisa que os grupos não foram ativados', async () => {
    h.resp.entrar_no_grupo = { error: { code: 'PGRST202', message: 'Could not find the function' } }
    await rodar(entrarNoGrupo(fd({ codigo: 'K7Q2MD', apelido: 'Ana' }))); expect(h.redirects[0]).toBe('/grupos?erro=desligado')
  })
  it('sair e mudar apelido', async () => {
    await rodar(sairDoGrupo(fd({ grupo: 'g1' }))); expect(h.rpc[0]).toEqual({ n: 'sair_do_grupo', a: { p_grupo: 'g1' } })
    await rodar(mudarApelido(fd({ grupo: 'g1', apelido: '  Aninha ' }))); expect(h.update).toEqual([{ apelido: 'Aninha' }])
  })
})

describe('grupos: tela e convite', () => {
  it('sem grupo: explica e oferece criar e entrar, com o apelido sugerido', async () => {
    const html = renderToStaticMarkup(await Grupos({ searchParams: Promise.resolve({}) }))
    expect(html).toContain('ainda não está em nenhum grupo'); expect(html).toContain('Criar um grupo'); expect(html).toContain('value="Ana"')
  })
  it('com grupo: ranking com você destacado e quem não tem plano sem posição', async () => {
    h.meus = [{ grupo_id: 'g1', apelido: 'Ana', grupos: { id: 'g1', nome: 'Turma', codigo: 'K7Q2MD' } }]
    h.ranking = [L({ apelido: 'Ana', eu: true, feito: 30 }), L({ apelido: 'Bia', feito: 90, questoes: 12, dias: 3 }), L({ apelido: 'Caio', planejado: 0, feito: 0 })]
    const html = renderToStaticMarkup(await Grupos({ searchParams: Promise.resolve({}) }))
    expect(html).toContain('Turma'); expect(html).toContain('K7Q2MD'); expect(html).toContain('90% do plano'); expect(html).toContain('(você)')
    expect(html).toContain('sem plano na semana'); expect(html).toContain('12 questões · 3 dias com estudo')
    expect(h.rpc.find(r => r.n === 'ranking_do_grupo')!.a.p_grupo).toBe('g1')
  })
  it('link de convite: o código vem preenchido', async () => {
    const html = renderToStaticMarkup(await Grupos({ searchParams: Promise.resolve({ codigo: 'k7q2md' }) }))
    expect(html).toContain('value="K7Q2MD"')
  })
  it('sem a migração: avisa em vez de quebrar', async () => {
    h.meusErro = { message: 'relation "grupo_membros" does not exist' }
    expect(renderToStaticMarkup(await Grupos({ searchParams: Promise.resolve({}) }))).toContain('ainda não foram ativados')
  })
})

describe('convite aberto sem conta', () => {
  it('o middleware guarda o código antes de mandar para a entrada', async () => {
    vi.resetModules()
    vi.doMock('@supabase/ssr', () => ({ createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) }))
    const { middleware: mw } = await import('@/middleware')
    const r = await mw(new NextRequest('https://r1tmo.com.br/grupos?codigo=K7Q2MD'))
    expect(new URL(r.headers.get('location')!).pathname).toBe('/login'); expect(r.cookies.get('convite')?.value).toBe('K7Q2MD')
    const r2 = await mw(new NextRequest('https://r1tmo.com.br/inicio'))
    expect(r2.cookies.get('convite')).toBeUndefined()
    vi.doUnmock('@supabase/ssr')
  })
})
