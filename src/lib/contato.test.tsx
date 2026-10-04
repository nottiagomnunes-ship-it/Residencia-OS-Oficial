import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

type Op = { t: string; tipo: string; dados?: any; filtros: string[] }
const h = vi.hoisted(() => ({
  ops: [] as Op[], redirects: [] as string[], admin: true, user: { id: 'u1' } as { id: string } | null,
  erroInsert: null as null | { message: string },
  resp: (() => ({ data: [], count: 0, error: null })) as (t: string, filtros: string[]) => any,
  adminInserts: [] as any[],
}))
const cadeia = (t: string) => {
  const op: Op = { t, tipo: 'select', filtros: [] }
  const r: any = {}
  r.select = () => r
  for (const m of ['order', 'limit', 'range', 'or']) r[m] = () => r
  r.maybeSingle = r.single = async () => ({ data: null, error: null })
  for (const m of ['eq', 'is', 'gte', 'not', 'in', 'neq', 'lte', 'gt', 'lt']) r[m] = (...a: any[]) => { op.filtros.push(`${m}(${a.join(',')})`); return r }
  r.insert = (d: any) => { op.tipo = 'insert'; op.dados = d; h.ops.push(op); return r }
  r.update = (d: any) => { op.tipo = 'update'; op.dados = d; h.ops.push(op); return r }
  r.delete = () => { op.tipo = 'delete'; h.ops.push(op); return r }
  r.then = (ok: any) => Promise.resolve(op.tipo === 'insert' ? { error: h.erroInsert } : op.tipo !== 'select' ? { error: null } : h.resp(t, op.filtros)).then(ok)
  return r
}
vi.mock('@/lib/supabase/server', () => ({ supabaseServer: async () => ({
  auth: { getUser: async () => ({ data: { user: h.user } }) }, from: (t: string) => cadeia(t),
  rpc: async (nome: string) => ({ data: nome === 'eh_admin' ? h.admin : null, error: null }),
}) }))
vi.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: () => ({ from: () => ({ insert: async (d: any) => { h.adminInserts.push(d); return { error: null } } }) }) }))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({ redirect: (u: string) => { h.redirects.push(u); throw new Error('REDIRECT') }, usePathname: () => '/x' }))

import { enviarMensagem, responderMensagem, limparErros } from './contato'
import { POST } from '@/app/api/erros/route'
import { onRequestError } from '@/instrumentation'
import { agruparErros, ehErroDeControle } from './engine/erros'
import { responsavel } from './engine/legal'
import Contato from '@/app/(app)/contato/page'
import Mensagens from '@/app/(app)/admin/mensagens/page'
import Termos from '@/app/termos/page'
import Privacidade from '@/app/privacidade/page'
import Pendencias from '@/app/(app)/admin/page'

const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.append(k, v); return f }
const msg = () => decodeURIComponent(h.redirects.at(-1)!)
const inserts = (t: string) => h.ops.filter(o => o.t === t && o.tipo === 'insert')
beforeEach(() => { Object.assign(h, { ops: [], redirects: [], admin: true, user: { id: 'u1' }, erroInsert: null, adminInserts: [], resp: () => ({ data: [], count: 0, error: null }) }) })

describe('enviar uma sugestão ou problema', () => {
  it('grava tipo, texto, página e navegador e volta com "enviada"', async () => {
    await expect(enviarMensagem(fd({ tipo: 'problema', texto: '  A prova travou  ', pagina: '/provas/tentativa/1', navegador: 'Firefox' }))).rejects.toThrow('REDIRECT')
    expect(inserts('mensagens')[0].dados).toEqual({ tipo: 'problema', texto: 'A prova travou', pagina: '/provas/tentativa/1', navegador: 'Firefox' })
    expect(msg()).toBe('/contato?ok=Mensagem enviada. Obrigado! A resposta aparece aqui embaixo.')
  })
  it('página que não é um endereço do app não vai junto', async () => {
    await expect(enviarMensagem(fd({ tipo: 'sugestao', texto: 'Ideia boa', pagina: 'https://outro.site' }))).rejects.toThrow('REDIRECT')
    expect(inserts('mensagens')[0].dados.pagina).toBeNull()
  })
  it('recusa sem gravar: tipo inválido, texto vazio', async () => {
    await expect(enviarMensagem(fd({ tipo: 'spam', texto: 'Oi oi' }))).rejects.toThrow('REDIRECT'); expect(msg()).toContain('Escolha o tipo')
    await expect(enviarMensagem(fd({ tipo: 'outro', texto: ' a ' }))).rejects.toThrow('REDIRECT'); expect(msg()).toContain('Escreva a sua mensagem')
    expect(inserts('mensagens')).toEqual([])
  })
  it('limite por hora e banco sem a migration: mensagens claras', async () => {
    h.erroInsert = { message: 'Muitas mensagens em pouco tempo. Tente de novo mais tarde.' }
    await expect(enviarMensagem(fd({ tipo: 'outro', texto: 'Olá' }))).rejects.toThrow('REDIRECT'); expect(msg()).toContain('Muitas mensagens em pouco tempo')
    h.erroInsert = { message: 'relation "public.mensagens" does not exist' }
    await expect(enviarMensagem(fd({ tipo: 'outro', texto: 'Olá' }))).rejects.toThrow('REDIRECT'); expect(msg()).toContain('0046_mensagens_erros.sql')
  })
  it('sem sessão: vai para o login', async () => {
    h.user = null
    await expect(enviarMensagem(fd({ tipo: 'outro', texto: 'Olá' }))).rejects.toThrow('REDIRECT'); expect(h.redirects[0]).toBe('/login')
  })
})

describe('responder (Administração)', () => {
  it('responde e resolve; sem resposta, só resolve; reabrir limpa o "resolvida"', async () => {
    await expect(responderMensagem(fd({ id: 'm1', acao: 'resolver', resposta: ' Corrigido! ' }))).rejects.toThrow('REDIRECT')
    const u = h.ops.filter(o => o.t === 'mensagens' && o.tipo === 'update')
    expect(u[0].dados).toMatchObject({ resposta: 'Corrigido!' }); expect(u[0].dados.resolvida_em).toBeTruthy(); expect(u[0].dados.respondida_em).toBeTruthy(); expect(u[0].filtros).toEqual(['eq(id,m1)'])
    expect(msg()).toContain('Resposta enviada')
    await expect(responderMensagem(fd({ id: 'm1', acao: 'resolver' }))).rejects.toThrow('REDIRECT')
    expect(h.ops.filter(o => o.tipo === 'update')[1].dados).not.toHaveProperty('resposta')
    await expect(responderMensagem(fd({ id: 'm1', acao: 'reabrir' }))).rejects.toThrow('REDIRECT')
    expect(h.ops.filter(o => o.tipo === 'update')[2].dados).toEqual({ resolvida_em: null }); expect(msg()).toContain('reaberta')
  })
  it('só a conta administradora responde ou apaga erros', async () => {
    h.admin = false
    await expect(responderMensagem(fd({ id: 'm1', resposta: 'x' }))).rejects.toThrow('REDIRECT')
    await expect(limparErros(fd({}))).rejects.toThrow('REDIRECT')
    expect(h.ops).toEqual([]); expect(h.redirects).toEqual(['/inicio', '/inicio'])
  })
  it('apagar erros: todos, ou só os de uma mensagem', async () => {
    await expect(limparErros(fd({ mensagem: 'x is undefined' }))).rejects.toThrow('REDIRECT')
    await expect(limparErros(fd({}))).rejects.toThrow('REDIRECT')
    const d = h.ops.filter(o => o.t === 'erros_app' && o.tipo === 'delete')
    expect(d[0].filtros).toEqual(['eq(mensagem,x is undefined)']); expect(d[1].filtros).toEqual(['gte(criado_em,1970-01-01)'])
  })
})

describe('erros do site', () => {
  const req = (b: unknown) => new Request('http://x/api/erros', { method: 'POST', body: JSON.stringify(b), headers: { 'user-agent': 'Chrome' } })
  it('o navegador avisa: grava em nome da conta, sempre responde 204', async () => {
    const r = await POST(req({ mensagem: 'x is undefined', digest: '123', pagina: '/banco', detalhe: 'stack' }))
    expect(r.status).toBe(204)
    expect(inserts('erros_app')[0].dados).toEqual({ origem: 'navegador', mensagem: 'x is undefined', digest: '123', pagina: '/banco', detalhe: 'stack', navegador: 'Chrome', user_id: 'u1' })
  })
  it('sem sessão ou sem mensagem: não grava, e mesmo assim responde 204', async () => {
    h.user = null; expect((await POST(req({ mensagem: 'a' }))).status).toBe(204)
    h.user = { id: 'u1' }; expect((await POST(req({}))).status).toBe(204)
    expect((await POST(new Request('http://x', { method: 'POST', body: 'não é json' }))).status).toBe(204)
    expect(inserts('erros_app')).toEqual([])
  })
  describe('no servidor', () => {
    const antes = { ...process.env }
    afterEach(() => { process.env = { ...antes } })
    it('grava com a chave de serviço; ignora redirecionamento e "não encontrado"; sem a chave, não faz nada', async () => {
      process.env.NEXT_RUNTIME = 'nodejs'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'k'
      const err = Object.assign(new Error('falhou'), { digest: '999' })
      await onRequestError(err, { path: '/banco', method: 'GET' }, { routerKind: 'App Router', routeType: 'render' })
      expect(h.adminInserts[0]).toMatchObject({ origem: 'servidor', mensagem: 'falhou', digest: '999', pagina: 'GET /banco', user_id: null })
      await onRequestError(Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/login;307;' }), { path: '/', method: 'GET' }, { routerKind: 'App Router', routeType: 'render' })
      await onRequestError(Object.assign(new Error('x'), { digest: 'NEXT_HTTP_ERROR_FALLBACK;404' }), { path: '/', method: 'GET' }, { routerKind: 'App Router', routeType: 'render' })
      delete process.env.SUPABASE_SERVICE_ROLE_KEY
      await onRequestError(err, { path: '/banco', method: 'GET' }, { routerKind: 'App Router', routeType: 'render' })
      expect(h.adminInserts).toHaveLength(1)
    })
  })
  it('agrupa por mensagem: vezes, último, páginas, contas e origens; mais recente primeiro', () => {
    const g = agruparErros([
      { criado_em: '2026-10-01T10:00:00Z', origem: 'navegador', mensagem: 'A', pagina: '/a', detalhe: 'velho', user_id: 'u1' },
      { criado_em: '2026-10-03T10:00:00Z', origem: 'servidor', mensagem: 'A', pagina: '/b', detalhe: 'novo', user_id: null },
      { criado_em: '2026-10-02T10:00:00Z', origem: 'navegador', mensagem: 'B', pagina: '/a', detalhe: null, user_id: 'u2' },
      { criado_em: '2026-10-01T09:00:00Z', origem: 'navegador', mensagem: 'A', pagina: '/a', detalhe: null, user_id: 'u1' },
    ])
    expect(g.map(x => x.mensagem)).toEqual(['A', 'B'])
    expect(g[0]).toMatchObject({ vezes: 3, ultimo: '2026-10-03T10:00:00Z', paginas: ['/a', '/b'], contas: 1, origens: ['navegador', 'servidor'], detalhe: 'novo' })
    expect(ehErroDeControle('NEXT_NOT_FOUND')).toBe(true); expect(ehErroDeControle('12345')).toBe(false); expect(ehErroDeControle(undefined)).toBe(false)
  })
})

describe('páginas', () => {
  it('Sugestões: formulário com o tipo vindo do link, página do erro e as minhas mensagens com a resposta', async () => {
    h.resp = t => (t === 'mensagens' ? { data: [
      { id: 'm1', tipo: 'sugestao', texto: 'Modo escuro', pagina: null, criada_em: '2026-10-01T10:00:00Z', resposta: 'Já tem!', respondida_em: '2026-10-02T10:00:00Z', resolvida_em: '2026-10-02T10:00:00Z' },
      { id: 'm2', tipo: 'problema', texto: 'Travou', pagina: '/banco', criada_em: '2026-10-03T10:00:00Z', resposta: null, respondida_em: null, resolvida_em: null }], error: null } : { data: [], error: null })
    const html = renderToStaticMarkup(await Contato({ searchParams: Promise.resolve({ tipo: 'problema', de: '/provas/tentativa/9' }) }))
    expect(html).toMatch(/checked="" value="problema"/)
    expect(html).toContain('name="pagina" value="/provas/tentativa/9"')
    expect(html).toContain('Suas mensagens'); expect(html).toContain('Já tem!'); expect(html).toContain('Resolvida'); expect(html).toContain('Aguardando')
    expect(html).toContain('href="/termos"'); expect(html).toContain('href="/privacidade"')
    const sem = renderToStaticMarkup(await Contato({ searchParams: Promise.resolve({ de: 'https://mal.site' }) }))
    expect(sem).toMatch(/checked="" value="sugestao"/); expect(sem).toContain('name="pagina" value=""')
  })
  it('Sugestões sem a migration: avisa que ainda não está ativa', async () => {
    h.resp = () => ({ data: null, error: { message: 'relation does not exist' } })
    expect(renderToStaticMarkup(await Contato({ searchParams: Promise.resolve({}) }))).toContain('ainda não está ativa')
  })
  it('Administração → Mensagens: em aberto (com resposta) e os erros agrupados', async () => {
    h.resp = (t, f) => t === 'mensagens'
      ? { data: [{ id: 'm2', user_id: 'abcdef12-0000', tipo: 'problema', texto: 'Travou', pagina: '/banco', navegador: 'Chrome', criada_em: '2026-10-03T10:00:00Z', resposta: null, resolvida_em: null }], error: null, filtros: f }
      : t === 'erros_app' ? { data: [{ criado_em: '2026-10-03T10:00:00Z', origem: 'navegador', mensagem: 'x is undefined', pagina: '/banco', detalhe: 'stack', user_id: 'u1' },
        { criado_em: '2026-10-03T11:00:00Z', origem: 'navegador', mensagem: 'x is undefined', pagina: '/banco', detalhe: null, user_id: 'u2' }], error: null } : { data: [], error: null }
    const html = renderToStaticMarkup(await Mensagens({ searchParams: Promise.resolve({}) }))
    expect(html).toContain('Mensagens em aberto (1)'); expect(html).toContain('Travou'); expect(html).toContain('conta abcdef12'); expect(html).toContain('Responder e marcar como resolvida')
    expect(html).toContain('Erros do site (2)'); expect(html).toContain('2×'); expect(html).toContain('2 contas'); expect(html).toContain('x is undefined')
  })
  it('Administração → Mensagens: só a administradora', async () => {
    h.admin = false
    await expect(Mensagens({ searchParams: Promise.resolve({}) })).rejects.toThrow('REDIRECT'); expect(h.redirects).toEqual(['/banco'])
  })
  it('Pendências mostra mensagens em aberto e erros das últimas 24 h', async () => {
    h.resp = (t, f) => (t === 'mensagens' ? { count: 2, error: null } : t === 'erros_app' && f.some(x => x.startsWith('gte(criado_em')) ? { count: 5, error: null } : { data: [], count: 0, error: null })
    const html = renderToStaticMarkup(await Pendencias())
    expect(html).toContain('href="/admin/mensagens"'); expect(html).toMatch(/2<\/b> em aberto/); expect(html).toMatch(/5<\/b> erros do site nas últimas 24/)
    expect(html).not.toContain('Tudo em dia')
  })
  it('Termos e Privacidade: públicas, com os serviços usados e sem nome pessoal fixo; responsável e e-mail vêm da configuração', () => {
    const t = renderToStaticMarkup(Termos()), p = renderToStaticMarkup(Privacidade())
    expect(t).toContain('Não é orientação médica'); expect(t).toContain('inteligência artificial')
    for (const s of ['Supabase', 'Vercel', 'Resend', 'Lei 13.709/2018', 'Apagar tudo', 'ANPD']) expect(p).toContain(s)
    expect(p).toContain('a administração do Residência OS'); expect(p).not.toContain('mailto:')
    expect(responsavel({ NEXT_PUBLIC_RESPONSAVEL: 'Fulano', NEXT_PUBLIC_CONTATO: 'f@x.com' })).toEqual({ nome: 'Fulano', email: 'f@x.com' })
    expect(responsavel({ NEXT_PUBLIC_CONTATO: 'não é email' })).toEqual({ nome: 'a administração do Residência OS', email: null })
  })
})
