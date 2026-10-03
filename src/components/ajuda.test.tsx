import { describe, it, expect, vi } from 'vitest'
import { existsSync } from 'fs'
import { renderToStaticMarkup } from 'react-dom/server'
const h = vi.hoisted(() => ({ chamadas: [] as string[] }))
vi.mock('@/lib/tutorial', () => ({ marcarTutorialVisto: async () => { h.chamadas.push('marcar') } }))
import Tutorial, { RevisarTutorial } from './Tutorial'
import BuscaAjuda from './BuscaAjuda'
import Ajuda from '../app/(app)/ajuda/page'
import { FAQ, PASSOS_TUTORIAL, buscarNaAjuda } from '@/lib/engine/ajuda'

const texto = (s: string) => s.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const paginaExiste = (href: string) => { const p = href.split('?')[0].replace(/^\//, ''); return existsSync(`src/app/(app)/${p}/page.tsx`) || existsSync(`src/app/${p}/page.tsx`) }

describe('conteúdo', () => {
  it('todo link do tutorial e da Ajuda leva a uma página que existe', () => {
    const links = [...PASSOS_TUTORIAL.flatMap(p => (p.link ? [p.link.href] : [])), ...FAQ.flatMap(s => s.perguntas.flatMap(q => (q.links ?? []).map(l => l.href)))]
    expect(links.length).toBeGreaterThan(10)
    expect(links.filter(l => !paginaExiste(l))).toEqual([])
  })
  it('perguntas sem repetição e com resposta', () => {
    const ps = FAQ.flatMap(s => s.perguntas.map(q => q.p)); expect(new Set(ps).size).toBe(ps.length)
    expect(FAQ.flatMap(s => s.perguntas).every(q => q.r.length > 30)).toBe(true)
  })
  it('busca sem acento, todas as palavras, e some com seções vazias', () => {
    const r = buscarNaAjuda(FAQ, 'revisao intervalos')
    expect(r.flatMap(s => s.perguntas.map(q => q.p))).toContain('Como funcionam as revisões?')
    expect(buscarNaAjuda(FAQ, 'plantao').flatMap(s => s.perguntas).length).toBeGreaterThan(0)
    expect(buscarNaAjuda(FAQ, 'xyzxyz')).toEqual([]); expect(buscarNaAjuda(FAQ, '  ')).toHaveLength(FAQ.length)
  })
})

describe('tutorial', () => {
  it('conta nova: abre no primeiro passo, como janela acessível, com "Pular"', () => {
    const html = renderToStaticMarkup(<Tutorial primeiraVez />)
    expect(html).toContain('role="dialog"'); expect(html).toContain('aria-modal="true"')
    expect(texto(html)).toContain(`Passo 1 de ${PASSOS_TUTORIAL.length}`); expect(texto(html)).toContain('Bem-vindo ao Residência OS'); expect(texto(html)).toContain('Pular')
  })
  it('quem já viu: nada aparece sozinho', () => { expect(renderToStaticMarkup(<Tutorial primeiraVez={false} />)).toBe('') })
  it('a página Ajuda tem "Rever o tutorial" e as perguntas', () => {
    const html = renderToStaticMarkup(<Ajuda />)
    expect(texto(html)).toContain('Rever o tutorial'); expect(texto(html)).toContain('Qual a diferença entre Minha semana e a Agenda pessoal?')
    expect(renderToStaticMarkup(<RevisarTutorial />)).toContain('type="button"')
    expect((renderToStaticMarkup(<BuscaAjuda />).match(/<details/g) ?? []).length).toBe(FAQ.reduce((n, s) => n + s.perguntas.length, 0))
  })
})
