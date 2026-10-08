import { it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
vi.mock('@/lib/importar', () => ({ lerPdf: async () => ({}), importarCronograma: async () => ({ ok: true }), limparCatalogo: async () => ({ resumo: '' }) }))
import Importador from './Importador'

it('importação: oferece o cronograma pronto e mostra o aviso que veio do assistente', () => {
  const html = renderToStaticMarkup(<Importador hoje="2026-10-08" total={0} erro="Não foi possível carregar o cronograma pronto." />)
  expect(html).toContain('Não tem um cronograma?'); expect(html).toContain('Usar o cronograma pronto')
  expect(html).toContain('role="alert"'); expect(html).toContain('Não foi possível carregar o cronograma pronto.')
  expect(renderToStaticMarkup(<Importador hoje="2026-10-08" total={0} />)).not.toContain('role="alert"')
})
