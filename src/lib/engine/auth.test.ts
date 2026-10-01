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
