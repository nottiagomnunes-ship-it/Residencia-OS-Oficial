import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import Marca from './Marca'

describe('logo (Marca)', () => {
  it('"R1" grifado em verde e "TMO" na cor do texto, na fonte do logo; lido como "R1TMO" por leitor de tela', () => {
    const html = renderToStaticMarkup(<Marca />)
    expect(html).toContain('aria-label="R1TMO"'); expect(html).toContain('role="img"'); expect(html).toContain('font-logo')
    expect(html).toMatch(/<span[^>]*bg-grifo[^>]*text-on-grifo[^>]*>R1<\/span>/)
    expect(html).toContain('>TMO</span>'); expect(html).not.toContain('<svg')
  })
  it('os tamanhos mudam só a escala', () => {
    expect(renderToStaticMarkup(<Marca tamanho="sm" />)).toContain('text-lg')
    expect(renderToStaticMarkup(<Marca tamanho="lg" />)).toContain('text-5xl')
  })
})
