import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
const h = vi.hoisted(() => ({ path: '/semana' }))
vi.mock('next/navigation', () => ({ usePathname: () => h.path }))
import { Sidebar, BottomNav, SubNav } from './Nav'

const texto = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const links = (s: string) => [...s.matchAll(/<a [^>]*href="([^"]+)"[^>]*>/g)].map(m => ({ href: m[1], atual: m[0].includes('aria-current="page"') }))

describe('menu lateral', () => {
  it('o logo (leva a Hoje), as 5 seções e, no rodapé, Configurações, Ajuda e Sugestões; a seção da página atual fica acesa', () => {
    h.path = '/semana'
    const html = renderToStaticMarkup(<Sidebar />)
    expect(links(html).map(l => l.href)).toEqual(['/inicio', '/inicio', '/calendario', '/banco', '/disciplinas', '/desempenho', '/configuracoes', '/ajuda', '/contato'])
    expect(links(html).filter(l => l.atual).map(l => l.href)).toEqual(['/calendario'])   // Meu tempo mora na Agenda
    expect(texto(html)).toContain('Hoje Agenda Questões Matérias Progresso')
  })
  it('recolhido: só os ícones, com o nome para leitores de tela', () => {
    const html = renderToStaticMarkup(<Sidebar recolhidoInicial />)
    expect(html).toContain('aria-label="Questões"'); expect(texto(html)).not.toContain('R1TMO')
  })
})

describe('celular', () => {
  it('barra de baixo: as 5 seções, sem "Mais"', () => {
    h.path = '/provas/tentativa/x'
    const html = renderToStaticMarkup(<BottomNav />)
    expect(links(html).map(l => l.href)).toEqual(['/inicio', '/calendario', '/banco', '/disciplinas', '/desempenho'])
    expect(links(html).find(l => l.atual)?.href).toBe('/banco'); expect(texto(html)).not.toContain('Mais')
  })
})

describe('abas no topo da página', () => {
  it('mostram as páginas da seção, com a atual acesa, e a engrenagem/ajuda (no celular)', () => {
    h.path = '/semana'
    const html = renderToStaticMarkup(<SubNav />)
    expect(texto(html)).toContain('Calendário Plano Meu tempo Compromissos')
    expect(links(html).filter(l => l.atual).map(l => l.href)).toEqual(['/semana'])
    expect(html).toContain('aria-label="Configurações"'); expect(html).toContain('aria-label="Ajuda"')
  })
  it('página filha acende a aba "mãe": importar o plano → Plano', () => {
    h.path = '/importar'
    expect(links(renderToStaticMarkup(<SubNav />)).filter(l => l.atual).map(l => l.href)).toEqual(['/cronograma'])
  })
})
