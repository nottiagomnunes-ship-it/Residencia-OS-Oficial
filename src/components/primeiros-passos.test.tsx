import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import PrimeirosPassos from './PrimeirosPassos'

it('cartão "Comece por aqui": uma ação por situação', () => {
  const estudar = renderToStaticMarkup(<PrimeirosPassos passo={{ tipo: 'estudar', titulo: 'Imunizações', minutos: 75, href: '/conteudos/t1' }} />)
  expect(estudar).toContain('Comece por aqui'); expect(estudar).toContain('Imunizações'); expect(estudar).toContain('75 min')
  expect(estudar).toContain('href="/conteudos/t1"'); expect(estudar).toContain('href="/banco/praticar"')
  expect(renderToStaticMarkup(<PrimeirosPassos passo={{ tipo: 'sem-assuntos' }} />)).toContain('href="/importar"')
  expect(renderToStaticMarkup(<PrimeirosPassos passo={{ tipo: 'sem-plano-hoje' }} />)).toContain('href="/cronograma"')
  expect(renderToStaticMarkup(<PrimeirosPassos passo={null} />)).toBe('')
})
