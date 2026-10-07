import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({
  redirects: [] as string[], ua: 'Mozilla/5.0 (Windows NT 10.0) Chrome/130', oauth: [] as any[],
  oauthResp: { data: { url: 'https://x.supabase.co/auth/v1/authorize?provider=google' }, error: null } as any,
  troca: { error: null } as any,
}))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'user-agent': h.ua, host: 'r1tmo.vercel.app', 'x-forwarded-proto': 'https' }),
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}))
vi.mock('next/navigation', () => ({ redirect: (u: string) => { h.redirects.push(u); throw new Error('REDIRECT') } }))
vi.mock('@/lib/supabase/server', () => ({ supabaseServer: async () => ({ auth: {
  signInWithOAuth: async (o: any) => { h.oauth.push(o); return h.oauthResp },
  exchangeCodeForSession: async () => h.troca,
  verifyOtp: async () => ({ error: null }),
} }) }))

import { googleLigado, navegadorEmbutido, mensagemGoogle } from './engine/auth'
import { entrarComGoogle } from './auth'
import { GET } from '@/app/auth/confirm/route'
import Login from '@/app/login/page'
import Cadastro from '@/app/cadastro/page'
import Privacidade from '@/app/privacidade/page'

const sp = (o: Record<string, string> = {}) => Promise.resolve(o)
beforeEach(() => { h.redirects = []; h.oauth = []; h.ua = 'Mozilla/5.0 (Windows NT 10.0) Chrome/130'; h.troca = { error: null }; vi.stubEnv('LOGIN_GOOGLE', 'ligado') })
afterEach(() => vi.unstubAllEnvs())

describe('entrar com o Google: regras', () => {
  it('só liga com LOGIN_GOOGLE', () => {
    expect(googleLigado('ligado')).toBe(true); expect(googleLigado(' 1 ')).toBe(true)
    expect(googleLigado(undefined)).toBe(false); expect(googleLigado('')).toBe(false); expect(googleLigado('desligado')).toBe(false)
  })
  it('reconhece navegadores embutidos de outros apps', () => {
    expect(navegadorEmbutido('Mozilla/5.0 (iPhone) Instagram 300.0')).toBe(true)
    expect(navegadorEmbutido('Mozilla/5.0 (iPhone) [FBAN/FBIOS;FBAV/400]')).toBe(true)
    expect(navegadorEmbutido('Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit Chrome/120')).toBe(true)
    expect(navegadorEmbutido('Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile')).toBe(false)
    expect(navegadorEmbutido('Mozilla/5.0 (iPhone) Version/17 Mobile Safari/604.1')).toBe(false)
    expect(navegadorEmbutido(null)).toBe(false)
  })
  it('mensagens de volta', () => {
    expect(mensagemGoogle('access_denied')).toContain('cancelada')
    expect(mensagemGoogle(null)).toContain('e-mail e senha')
  })
})

describe('entrar com o Google: fluxo', () => {
  it('manda para o Google com a volta em /auth/confirm?via=google', async () => {
    await expect(entrarComGoogle()).rejects.toThrow('REDIRECT')
    expect(h.oauth[0]).toMatchObject({ provider: 'google', options: { redirectTo: 'https://r1tmo.vercel.app/auth/confirm?via=google', queryParams: { prompt: 'select_account' } } })
    expect(h.redirects).toEqual(['https://x.supabase.co/auth/v1/authorize?provider=google'])
  })
  it('desligado: não chama o Google e volta para a entrada com aviso', async () => {
    vi.stubEnv('LOGIN_GOOGLE', '')
    await expect(entrarComGoogle()).rejects.toThrow('REDIRECT')
    expect(h.oauth).toEqual([]); expect(h.redirects[0]).toMatch(/^\/login\?erro=/)
  })
  it('volta do Google: código válido entra em /inicio', async () => {
    const r = await GET(new NextRequest('https://r1tmo.vercel.app/auth/confirm?via=google&code=abc'))
    expect(new URL(r.headers.get('location')!).pathname).toBe('/inicio')
  })
  it('volta do Google cancelada ou com erro: entrada com a mensagem (não a página de senha)', async () => {
    let r = await GET(new NextRequest('https://r1tmo.vercel.app/auth/confirm?via=google&error=access_denied&error_description=x'))
    let u = new URL(r.headers.get('location')!)
    expect(u.pathname).toBe('/login'); expect(u.searchParams.get('erro')).toContain('cancelada')
    h.troca = { error: { message: 'bad code' } }
    r = await GET(new NextRequest('https://r1tmo.vercel.app/auth/confirm?via=google&code=ruim'))
    u = new URL(r.headers.get('location')!)
    expect(u.pathname).toBe('/login'); expect(u.searchParams.get('erro')).toContain('Não foi possível entrar com o Google')
  })
  it('link de e-mail com erro continua indo para recuperar senha', async () => {
    h.troca = { error: { message: 'bad code' } }
    const r = await GET(new NextRequest('https://r1tmo.vercel.app/auth/confirm?code=ruim'))
    expect(new URL(r.headers.get('location')!).pathname).toBe('/recuperar-senha')
  })
})

describe('entrar com o Google: telas', () => {
  it('entrada e cadastro mostram o botão (fora do formulário de senha) quando ligado', async () => {
    for (const html of [renderToStaticMarkup(await Login({ searchParams: sp() })), renderToStaticMarkup(await Cadastro({ searchParams: sp() }))]) {
      expect(html).toContain('Continuar com o Google'); expect(html).toContain('ou com e-mail')
      expect(html.match(/<form/g)).toHaveLength(2) // um formulário para o Google e outro para e-mail/senha, sem um dentro do outro
    }
  })
  it('desligado: entrada e cadastro como antes', async () => {
    vi.stubEnv('LOGIN_GOOGLE', '')
    const html = renderToStaticMarkup(await Login({ searchParams: sp({ erro: 'E-mail ou senha incorretos.' }) }))
    expect(html).not.toContain('Google'); expect(html).toContain('E-mail ou senha incorretos.'); expect(html.match(/<form/g)).toHaveLength(1)
  })
  it('dentro do Instagram: no lugar do botão, explica como abrir no navegador', async () => {
    h.ua = 'Mozilla/5.0 (iPhone) Instagram 300.0'
    const html = renderToStaticMarkup(await Login({ searchParams: sp() }))
    expect(html).not.toContain('Continuar com o Google'); expect(html).toContain('abra esta página no Chrome ou no Safari')
  })
  it('Privacidade cita o Google e o que vem dele', () => {
    const p = renderToStaticMarkup(Privacidade())
    expect(p).toContain('Se você entrar com o Google'); expect(p).toContain('nome e foto do perfil'); expect(p).toContain('Apps e serviços de terceiros')
  })
})
