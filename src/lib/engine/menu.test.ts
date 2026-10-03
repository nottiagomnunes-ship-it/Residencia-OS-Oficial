import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync } from 'fs'
import { INICIO, GRUPOS, CONFIGURACOES, PAGINAS_DO_MENU, PRINCIPAIS, FILHAS, ativo } from './menu'

const pagina = (href: string) => existsSync(`src/app/(app)${href}/page.tsx`)
const ESCONDIDAS = ['diagnostico'] // páginas de apoio, de propósito fora do menu

describe('estrutura do menu', () => {
  it('Início no topo, Configurações no fim, e 13 páginas no total, sem repetir', () => {
    expect(PAGINAS_DO_MENU[0]).toEqual(INICIO); expect(PAGINAS_DO_MENU.at(-1)).toEqual(CONFIGURACOES); expect(PAGINAS_DO_MENU).toHaveLength(14)
    const hrefs = PAGINAS_DO_MENU.map(([, h]) => h); expect(new Set(hrefs).size).toBe(hrefs.length)
  })
  it('os quatro grupos, nesta ordem, cada um com itens', () => {
    expect(GRUPOS.map(g => g.titulo)).toEqual(['Planejar', 'Estudar', 'Acompanhar', 'Organizar']); for (const g of GRUPOS) expect(g.itens.length).toBeGreaterThan(0)
    expect(GRUPOS[0].itens.map(([n]) => n)).toEqual(['Meu Cronograma', 'Minha semana', 'Calendário'])
    expect(GRUPOS[1].itens.map(([n]) => n)).toEqual(['Revisões', 'Questões', 'Simulados', 'Provas', 'Caderno de Erros'])
  })
  it('todo item do menu leva a uma página que existe', () => { for (const [nome, href] of PAGINAS_DO_MENU) expect(pagina(href), `${nome} → ${href}`).toBe(true) })
  it('as abas fixas do celular estão no menu', () => { for (const h of PRINCIPAIS) expect(PAGINAS_DO_MENU.some(([, x]) => x === h)).toBe(true); expect(PRINCIPAIS).toEqual(['/inicio', '/calendario', '/revisoes', '/questoes']) })
  it('"Importar cronograma" saiu do menu, mas a página existe e destaca o Cronograma', () => {
    expect(PAGINAS_DO_MENU.some(([, h]) => h === '/importar')).toBe(false); expect(pagina('/importar')).toBe(true)
    expect(ativo('/importar', '/cronograma')).toBe(true); expect(ativo('/importar/qualquer', '/cronograma')).toBe(true); expect(ativo('/importar', '/calendario')).toBe(false)
  })
  it('destaque do item atual: a página e as que moram dentro dela', () => {
    expect(ativo('/conteudos/abc', '/conteudos')).toBe(true); expect(ativo('/provas/tentativa/x', '/provas')).toBe(true); expect(ativo('/cronograma', '/cronograma')).toBe(true); expect(ativo('/cronogramas', '/cronograma')).toBe(false); expect(ativo('/semana', '/cronograma')).toBe(false)
  })
  it('GUARDA: nenhuma página nova fica de fora do menu sem querer', () => {
    const noMenu = new Set([...PAGINAS_DO_MENU.map(([, h]) => h.slice(1)), ...Object.keys(FILHAS).map(f => f.slice(1)), ...ESCONDIDAS])
    const paginas = readdirSync('src/app/(app)', { withFileTypes: true }).filter(d => d.isDirectory() && existsSync(`src/app/(app)/${d.name}/page.tsx`)).map(d => d.name)
    expect(paginas.filter(p => !noMenu.has(p)), 'página fora do menu: inclua em GRUPOS, em FILHAS ou em ESCONDIDAS').toEqual([])
  })
  it('o resto de desenvolvimento ("Esta área será construída...") não existe mais', () => { expect(existsSync('src/app/(app)/[slug]')).toBe(false) })
})
