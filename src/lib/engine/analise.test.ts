import { describe, it, expect } from 'vitest'
import { limparUrl, mascararCaminho, limparEvento } from './analise'

const ID = '3f2b8c1e-9a4d-4c2b-8e1f-0a1b2c3d4e5f'
const S = 'https://r1tmo.vercel.app'

describe('análise de uso: endereço sem dados pessoais', () => {
  it('mantém páginas comuns', () => {
    expect(limparUrl(`${S}/inicio`)).toBe(`${S}/inicio`)
    expect(limparUrl(`${S}/`)).toBe(`${S}/`)
    expect(limparUrl(`${S}/banco/praticar`)).toBe(`${S}/banco/praticar`)
  })
  it('tira "?…" e "#…" (filtros, códigos, e-mail)', () => {
    expect(limparUrl(`${S}/banco/praticar?revisao=1`)).toBe(`${S}/banco/praticar`)
    expect(limparUrl(`${S}/redefinir-senha?code=abc&email=a%40b.com#token=x`)).toBe(`${S}/redefinir-senha`)
  })
  it('mascara ids, números e códigos longos', () => {
    expect(limparUrl(`${S}/provas/tentativa/${ID}`)).toBe(`${S}/provas/tentativa/[id]`)
    expect(limparUrl(`${S}/admin/questoes/1234`)).toBe(`${S}/admin/questoes/[id]`)
    expect(mascararCaminho('/x/abcDEF1234567890_-abcdef')).toBe('/x/[id]')
    expect(mascararCaminho('/x/fulano%40gmail.com')).toBe('/x/[id]')
  })
  it('não mascara nomes de página', () => {
    expect(mascararCaminho('/exportar/questoes')).toBe('/exportar/questoes')
    expect(mascararCaminho('/caderno-de-erros')).toBe('/caderno-de-erros')
    expect(mascararCaminho('/configuracoes-de-aparencia-longas')).toBe('/configuracoes-de-aparencia-longas')
  })
  it('não envia páginas de autenticação nem endereços inválidos', () => {
    expect(limparUrl(`${S}/auth/callback?code=xyz`)).toBeNull()
    expect(limparUrl('não é url')).toBeNull()
  })
  it('limparEvento mantém o resto do registro', () => {
    expect(limparEvento({ type: 'vital', url: `${S}/provas/${ID}?a=1`, route: '/provas/[id]' }))
      .toEqual({ type: 'vital', url: `${S}/provas/[id]`, route: '/provas/[id]' })
    expect(limparEvento({ type: 'pageview', url: `${S}/auth/x` })).toBeNull()
  })
})
