import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { EsqueletoPagina, EsqueletoInicio, EsqueletoCalendario } from './Esqueleto'
import Carregamento from '../app/(app)/loading'
import CarregamentoInicio from '../app/(app)/inicio/loading'
import CarregamentoCalendario from '../app/(app)/calendario/loading'
import NaoEncontrada from '../app/not-found'
import NaoEncontradaApp from '../app/(app)/not-found'
import Erro from '../app/(app)/error'
import ErroGlobal from '../app/global-error'

const h = (el: React.ReactElement) => renderToStaticMarkup(el)
const texto = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

describe('telas de carregamento', () => {
  for (const [nome, el] of [['página', <EsqueletoPagina />], ['início', <EsqueletoInicio />], ['calendário', <EsqueletoCalendario />]] as const) {
    it(`${nome}: avisa leitores de tela, é só visual por dentro e respeita "menos movimento"`, () => {
      const html = h(el)
      expect(html).toContain('role="status"'); expect(html).toContain('aria-busy="true"'); expect(html).toContain('sr-only'); expect(texto(html)).toBe('Carregando…')
      expect(html).toContain('motion-safe:animate-pulse'); expect(html).not.toMatch(/(?<!motion-safe:)animate-pulse/)    // nunca pulsa sem checar a preferência da pessoa
    })
  }
  it('o calendário esboça as 7 colunas da semana', () => { expect((h(<EsqueletoCalendario />).match(/rounded-xl border border-line p-2/g) ?? []).length).toBe(7) })
  it('cada loading.tsx entrega o esqueleto certo (padrão para o app, e próprios para início e calendário)', () => {
    expect(h(<Carregamento />)).toBe(h(<EsqueletoPagina />)); expect(h(<CarregamentoInicio />)).toBe(h(<EsqueletoInicio />)); expect(h(<CarregamentoCalendario />)).toBe(h(<EsqueletoCalendario />))
  })
})

describe('páginas de "não encontrada" e de erro', () => {
  it('404 geral: mensagem clara, tranquiliza sobre os dados e leva ao Início', () => {
    const html = h(<NaoEncontrada />); expect(texto(html)).toContain('Página não encontrada'); expect(texto(html)).toContain('dados estão seguros'); expect(html).toContain('href="/inicio"')
  })
  it('dentro do app: versão curta que aparece ao lado do menu', () => { const html = h(<NaoEncontradaApp />); expect(texto(html)).toContain('Não encontramos isso'); expect(html).toContain('href="/inicio"'); expect(html).not.toContain('min-h-dvh') })
  it('erro no app: tentar de novo e voltar ao Início', () => {
    const html = h(<Erro error={new Error('x')} reset={() => {}} />); expect(html).toContain('role="alert"'); expect(texto(html)).toContain('Tentar de novo'); expect(html).toContain('href="/inicio"'); expect(html).not.toContain('Error: x')    // não vaza o erro técnico
  })
  it('erro global (o esqueleto do app falhou): página completa, com botão de tentar de novo, sem expor o erro', () => {
    const html = h(<ErroGlobal error={Object.assign(new Error('segredo técnico'), { digest: 'abc' })} reset={() => {}} />)
    expect(html).toContain('<html'); expect(texto(html)).toContain('Tentar de novo'); expect(html).toContain('role="alert"'); expect(html).not.toContain('segredo técnico')
  })
})
