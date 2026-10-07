import { it, expect } from 'vitest'
import { destinoDoDominio } from './dominio'

it('sem DOMINIO_PRINCIPAL não redireciona nada', () => {
  expect(destinoDoDominio('r1tmo.vercel.app', '/inicio', '', undefined)).toBeNull()
  expect(destinoDoDominio('r1tmo.vercel.app', '/inicio', '', ' ')).toBeNull()
})
it('endereço antigo vai para o novo, com caminho e "?…"', () => {
  expect(destinoDoDominio('r1tmo.vercel.app', '/inicio', '', 'r1tmo.com.br')).toBe('https://r1tmo.com.br/inicio')
  expect(destinoDoDominio('R1TMO.vercel.app', '/auth/confirm', '?code=abc', 'https://r1tmo.com.br/')).toBe('https://r1tmo.com.br/auth/confirm?code=abc')
  expect(destinoDoDominio('residencia-os.vercel.app', '/', '', 'r1tmo.com.br')).toBe('https://r1tmo.com.br/')
})
it('não mexe no endereço novo, nas prévias da Vercel, no computador nem em /api/', () => {
  expect(destinoDoDominio('r1tmo.com.br', '/inicio', '', 'r1tmo.com.br')).toBeNull()
  expect(destinoDoDominio('r1tmo-git-main-tiago.vercel.app', '/inicio', '', 'r1tmo.com.br')).toBeNull()
  expect(destinoDoDominio('localhost:3000', '/inicio', '', 'r1tmo.com.br')).toBeNull()
  expect(destinoDoDominio('r1tmo.vercel.app', '/api/cron/lembretes', '', 'r1tmo.com.br')).toBeNull()
  expect(destinoDoDominio(null, '/', '', 'r1tmo.com.br')).toBeNull()
})
