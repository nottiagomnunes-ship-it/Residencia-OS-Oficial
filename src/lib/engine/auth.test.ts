import { it, expect } from 'vitest'
import { mensagemAuth, validarCadastro } from './auth'

it('traduz as mensagens mais comuns do Supabase', () => {
  expect(mensagemAuth('Invalid login credentials')).toBe('E-mail ou senha incorretos.')
  expect(mensagemAuth('User already registered')).toMatch(/já tem conta/)
  expect(mensagemAuth('Email not confirmed')).toMatch(/Confirme o seu e-mail/)
  expect(mensagemAuth('Password should be at least 6 characters.')).toMatch(/pelo menos 8/)
  expect(mensagemAuth('email rate limit exceeded')).toMatch(/Muitas tentativas/)
  expect(mensagemAuth('algo inesperado')).toMatch(/Não foi possível/)
})
it('valida o cadastro: e-mail, tamanho da senha e confirmação', () => {
  expect(validarCadastro('a@b.com', '12345678', '12345678')).toBeNull()
  expect(validarCadastro('sem-arroba', '12345678', '12345678')).toMatch(/e-mail/)
  expect(validarCadastro('a@b.com', '1234567', '1234567')).toMatch(/8 caracteres/)
  expect(validarCadastro('a@b.com', '12345678', '12345679')).toMatch(/não são iguais/)
})

import { validarSenhaNova, caminhoSeguro } from './auth'
it('nova senha: tamanho e confirmação', () => {
  expect(validarSenhaNova('12345678', '12345678')).toBeNull()
  expect(validarSenhaNova('1234567', '1234567')).toMatch(/8 caracteres/)
  expect(validarSenhaNova('12345678', 'abcdefgh')).toMatch(/não são iguais/)
})
it('o link de recuperação só pode levar a páginas do próprio site', () => {
  expect(caminhoSeguro('/redefinir-senha')).toBe('/redefinir-senha'); expect(caminhoSeguro(null)).toBe('/inicio')
  for (const ruim of ['https://outro.site', '//outro.site', '/\\outro', 'javascript:alert(1)', '', 'redefinir']) expect(caminhoSeguro(ruim)).toBe('/inicio')
})
it('mensagens de link vencido e senha repetida', () => {
  expect(mensagemAuth('Auth session missing!')).toMatch(/link expirou/)
  expect(mensagemAuth('New password should be different from the old password.')).toMatch(/diferente da atual/)
})
