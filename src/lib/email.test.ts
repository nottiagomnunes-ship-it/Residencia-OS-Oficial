import { describe, it, expect, vi, afterEach } from 'vitest'
import { enviarEmail } from './email'
import { classificarErroResend } from './engine/email'

const SANDBOX = 'You can only send testing emails to your own email address (a@b.com). To send emails to other recipients, please verify a domain at resend.com/domains.'
afterEach(() => { vi.unstubAllGlobals(); delete process.env.RESEND_API_KEY })

it('classifica as respostas do Resend', () => {
  expect(classificarErroResend(403, SANDBOX)).toBe('recusado_destinatario')
  expect(classificarErroResend(403, 'The meudominio.com domain is not verified.')).toBe('falha') // outro 403: não desliga o lembrete
  expect(classificarErroResend(401, '')).toBe('chave_invalida'); expect(classificarErroResend(500, '')).toBe('falha')
})
describe('enviarEmail', () => {
  const resposta = (status: number, corpo: object) => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(corpo), { status })))
  it('sem chave: não configurado, sem tentar enviar', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f)
    expect(await enviarEmail('a@b.com', 'x', '<p>x</p>', 'x')).toMatchObject({ ok: false, codigo: 'nao_configurado' }); expect(f).not.toHaveBeenCalled()
  })
  it('sucesso, recusa de destinatário e chave inválida', async () => {
    process.env.RESEND_API_KEY = ' re_teste '
    resposta(200, { id: '1' }); expect(await enviarEmail('a@b.com', 'x', 'h', 't')).toEqual({ ok: true })
    resposta(403, { message: SANDBOX }); expect(await enviarEmail('outra@b.com', 'x', 'h', 't')).toMatchObject({ ok: false, codigo: 'recusado_destinatario' })
    resposta(401, { message: 'API key is invalid' }); expect(await enviarEmail('a@b.com', 'x', 'h', 't')).toMatchObject({ ok: false, codigo: 'chave_invalida' })
  })
  it('envia a chave sem espaços e para o destinatário certo', async () => {
    process.env.RESEND_API_KEY = ' re_teste '
    const f = vi.fn(async () => new Response('{}', { status: 200 })); vi.stubGlobal('fetch', f)
    await enviarEmail('ela@b.com', 'Assunto', '<p>oi</p>', 'oi')
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.resend.com/emails'); expect((init.headers as Record<string, string>).Authorization).toBe('Bearer re_teste')
    expect(JSON.parse(init.body as string)).toMatchObject({ to: ['ela@b.com'], subject: 'Assunto' })
  })
})
