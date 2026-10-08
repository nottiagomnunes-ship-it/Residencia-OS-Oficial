import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import Inicial, { metadata } from '@/app/page'

it('página inicial pública: diz o que o app faz e leva para criar conta, entrar, Termos e Privacidade', () => {
  const html = renderToStaticMarkup(<Inicial />)
  expect(html).toContain('<h1'); expect(html).toContain('Estude no ritmo do seu dia')
  for (const href of ['/cadastro', '/login', '/termos', '/privacidade']) expect(html, href).toContain(`href="${href}"`)
  for (const t of ['Revisões automáticas', 'Questões e provas', 'Agenda do internato', 'Em fase de testes']) expect(html).toContain(t)
  expect(String(metadata.title)).toContain('R1TMO'); expect(metadata.description).toBeTruthy()
})
