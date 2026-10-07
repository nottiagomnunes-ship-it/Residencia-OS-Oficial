import { it, expect } from 'vitest'
import { ehErroDeVersao, podeRecarregar } from './versao'

it('reconhece os erros de versão trocada (inclusive o do iPhone de 07/10)', () => {
  for (const m of ["undefined is not an object (evaluating 'e[o].call')", "Cannot read properties of undefined (reading 'call')",
    'Loading chunk 1255 failed.', 'Loading CSS chunk app-layout failed', 'Failed to fetch dynamically imported module: https://x/a.js',
    'Importing a module script failed.', 'Failed to find Server Action "7f3a". This request might be from an older or newer deployment.',
    'Server Action "abc" was not found on the server.']) expect(ehErroDeVersao(m), m).toBe(true)
  expect(ehErroDeVersao('qualquer coisa', 'ChunkLoadError')).toBe(true)
})
it('não confunde com erros comuns', () => {
  for (const m of ['x is undefined', 'Failed to fetch', 'NEXT_NOT_FOUND', "Cannot read properties of null (reading 'nome')", '', null]) expect(ehErroDeVersao(m), String(m)).toBe(false)
})
it('recarrega no máximo uma vez por minuto', () => {
  expect(podeRecarregar(100_000, null)).toBe(true)
  expect(podeRecarregar(100_000, 50_000)).toBe(false)
  expect(podeRecarregar(100_000, 30_000)).toBe(true)
  expect(podeRecarregar(100_000, NaN)).toBe(true)
})
