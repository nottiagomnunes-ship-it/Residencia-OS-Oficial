import { it, expect } from 'vitest'
import { destinoDoLogin, ehPublica } from './rotas'

it('a página inicial abre sem conta, mas só ela (não "/qualquer-coisa")', () => {
  expect(ehPublica('/')).toBe(true)
  expect(ehPublica('/inicio')).toBe(false); expect(ehPublica('/banco')).toBe(false)
  for (const p of ['/login', '/cadastro', '/recuperar-senha', '/auth/confirm', '/termos', '/privacidade', '/api/cron/lembretes']) expect(ehPublica(p), p).toBe(true)
})
it('sem conta: páginas do app vão para a entrada; páginas públicas seguem', () => {
  expect(destinoDoLogin('/inicio', false)).toBe('/login')
  expect(destinoDoLogin('/', false)).toBeNull(); expect(destinoDoLogin('/cadastro', false)).toBeNull()
})
it('com conta: página inicial, entrada e cadastro vão para Hoje; o resto segue', () => {
  expect(destinoDoLogin('/', true)).toBe('/inicio'); expect(destinoDoLogin('/login', true)).toBe('/inicio'); expect(destinoDoLogin('/cadastro', true)).toBe('/inicio')
  expect(destinoDoLogin('/termos', true)).toBeNull(); expect(destinoDoLogin('/banco', true)).toBeNull()
})
