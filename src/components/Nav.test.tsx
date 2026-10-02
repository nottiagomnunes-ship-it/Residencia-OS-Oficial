import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
vi.mock('next/navigation', () => ({ usePathname: () => '/calendario' }))
import { Sidebar } from './Nav'

const html = renderToStaticMarkup(<Sidebar />)
const titulos = [...html.matchAll(/<p aria-hidden="true" class="([^"]*)"><span>([^<]+)<\/span><span aria-hidden="true" class="([^"]*)"><\/span><\/p>/g)]
const links = [...html.matchAll(/<a [^>]*class="([^"]*)"[^>]*>([^<]+)<\/a>/g)]

describe('menu: títulos de grupo não podem parecer botões', () => {
  it('os quatro títulos são rótulos: pequenos, maiúsculos, espaçados, com linha divisória e fora do alcance do toque', () => {
    expect(titulos.map(t => t[2])).toEqual(['Planejar', 'Estudar', 'Acompanhar', 'Organizar'])
    for (const [, classe, , linha] of titulos) {
      for (const c of ['uppercase', 'tracking-widest', 'font-semibold', 'select-none', 'text-xs']) expect(classe).toContain(c)
      expect(linha).toContain('h-px'); expect(linha).toContain('flex-1')
      expect(classe).not.toContain('hover:'); expect(classe).not.toContain('rounded-xl')     // nada de visual de botão
    }
  })
  it('os itens clicáveis usam a cor clara do app (os títulos usam o cinza), e têm destaque ao passar o dedo ou o mouse', () => {
    const itens = links.map(l => ({ classe: l[1], nome: l[2] })); expect(itens.length).toBe(13)
    for (const { classe, nome } of itens) { expect(classe, nome).not.toContain('text-muted'); expect(classe, nome).toContain('rounded-xl') }
    for (const { classe, nome } of itens.filter(i => i.nome !== 'Calendário')) expect(classe, nome).toContain('hover:bg-line/50')
    expect(itens.find(i => i.nome === 'Calendário')!.classe).toContain('text-brand')     // a página atual
    for (const [, classe] of titulos) expect(classe).toContain('text-muted')
  })
  it('há espaço maior entre os grupos para separá-los', () => { expect((html.match(/role="group" aria-label="[^"]+" class="mt-5 /g) ?? []).length).toBe(4) })
})
