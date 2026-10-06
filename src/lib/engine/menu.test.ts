import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync } from 'fs'
import { SECOES, AJUSTES, ADMIN, TODAS_AS_ABAS, secaoDe, abaDe, dentro } from './menu'

const pagina = (href: string) => existsSync(`src/app/(app)${href}/page.tsx`)

describe('o app em 5 seções', () => {
  it('Hoje, Agenda, Questões, Matérias e Progresso, nesta ordem; cada uma abre na sua primeira aba', () => {
    expect(SECOES.map(s => s.nome)).toEqual(['Hoje', 'Agenda', 'Questões', 'Matérias', 'Progresso'])
    for (const s of SECOES) expect(s.href).toBe(s.abas[0][1])
    expect(AJUSTES.abas.map(([n]) => n)).toEqual(['Configurações', 'Ajuda', 'Sugestões'])
  })
  it('as abas de cada seção', () => {
    expect(SECOES.map(s => s.abas.map(([n]) => n))).toEqual([
      ['Hoje', 'Revisões'], ['Calendário', 'Plano', 'Meu tempo', 'Compromissos'], ['Praticar', 'Banco', 'Provas', 'Registrar', 'Erros'],
      ['Disciplinas', 'Assuntos'], ['Desempenho', 'Metas', 'Simulados']])
  })
  it('toda aba leva a uma página que existe, e nenhuma aparece duas vezes', () => {
    for (const [nome, href] of TODAS_AS_ABAS) expect(pagina(href), `${nome} → ${href}`).toBe(true)
    const hs = TODAS_AS_ABAS.map(([, h]) => h); expect(new Set(hs).size).toBe(hs.length)
  })
  it('Administração (só a conta administradora): Pendências, Questões, Provas, Importar, Temas e Mensagens, todas existem', () => {
    expect(ADMIN.abas.map(([n]) => n)).toEqual(['Pendências', 'Questões', 'Provas', 'Importar', 'Temas', 'Mensagens'])
    for (const [nome, href] of ADMIN.abas) expect(pagina(href), `${nome} → ${href}`).toBe(true)
    expect(pagina('/admin/questoes/[id]')).toBe(true)
  })
  it('GUARDA: toda página do app pertence a uma seção (como aba ou como página "filha")', () => {
    const paginas = readdirSync('src/app/(app)', { withFileTypes: true }).filter(d => d.isDirectory() && existsSync(`src/app/(app)/${d.name}/page.tsx`)).map(d => '/' + d.name)
    expect(paginas.filter(p => !secaoDe(p)), 'página fora do menu: inclua como aba ou em "filhas" de uma seção').toEqual([])
  })
})

describe('onde a pessoa está', () => {
  const onde = (p: string) => { const s = secaoDe(p); return s ? `${s.nome} › ${abaDe(p, s)}` : null }
  it('páginas internas acendem a seção e a aba certas', () => {
    expect(onde('/inicio')).toBe('Hoje › /inicio'); expect(onde('/revisoes')).toBe('Hoje › /revisoes')
    expect(onde('/importar')).toBe('Agenda › /cronograma')                         // importar o plano mora em "Plano de estudo"
    expect(onde('/banco/praticar')).toBe('Questões › /banco')
    expect(onde('/admin')).toBe('Administração › /admin'); expect(onde('/admin/questoes/abc')).toBe('Administração › /admin/questoes')
    expect(onde('/admin/importar')).toBe('Administração › /admin/importar'); expect(onde('/admin/temas')).toBe('Administração › /admin/temas')
    expect(onde('/banco/questoes')).toBe('Questões › /banco/questoes'); expect(onde('/banco')).toBe('Questões › /banco')
    expect(onde('/provas/tentativa/abc')).toBe('Questões › /provas')
    expect(onde('/conteudos/abc')).toBe('Matérias › /conteudos'); expect(onde('/disciplinas/x')).toBe('Matérias › /disciplinas')
    expect(onde('/simulados')).toBe('Progresso › /simulados')
    expect(onde('/diagnostico')).toBe('Ajustes › /configuracoes'); expect(onde('/ajuda')).toBe('Ajustes › /ajuda')
    expect(onde('/login')).toBeNull()
  })
  it('"dentro" não confunde prefixos parecidos', () => { expect(dentro('/cronogramas', '/cronograma')).toBe(false); expect(dentro('/banco/x', '/banco')).toBe(true) })
})
