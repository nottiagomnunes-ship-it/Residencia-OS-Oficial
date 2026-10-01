'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export const ITENS = [
  ['Início', '/inicio'], ['Meu Cronograma', '/cronograma'], ['Minha semana', '/semana'], ['Calendário', '/calendario'], ['Revisões', '/revisoes'],
  ['Questões', '/questoes'], ['Desempenho', '/desempenho'], ['Caderno de Erros', '/caderno-de-erros'], ['Simulados', '/simulados'],
  ['Disciplinas', '/disciplinas'], ['Conteúdos', '/conteudos'], ['Importar cronograma', '/importar'], ['Metas', '/metas'], ['Configurações', '/configuracoes'],
] as const
const PRINCIPAIS = ['/inicio', '/calendario', '/revisoes', '/questoes']
const ativo = (path: string, href: string) => path === href || path.startsWith(href + '/')

export function Sidebar() {
  const path = usePathname()
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-1 overflow-y-auto border-r border-line bg-surface p-4 lg:flex">
      <div className="mb-6 px-3 text-lg font-semibold text-brand">Residência OS</div>
      {ITENS.map(([nome, href]) => (
        <Link key={href} href={href} aria-current={ativo(path, href) ? 'page' : undefined}
          className={`rounded-xl px-3 py-2 text-sm ${ativo(path, href) ? 'bg-brand/15 text-brand' : 'text-muted hover:bg-line/50'}`}>{nome}</Link>))}
    </aside>
  )
}

export function BottomNav() {
  const path = usePathname(), [aberto, setAberto] = useState(false)
  useEffect(() => setAberto(false), [path])
  const outros = ITENS.filter(([, h]) => !PRINCIPAIS.includes(h)), noMais = outros.some(([, h]) => ativo(path, h))
  const aba = (on: boolean) => `flex min-h-14 flex-1 items-center justify-center text-xs ${on ? 'text-brand' : 'text-muted'}`
  return (
    <>
      {aberto && (
        <div className="fixed inset-0 z-20 bg-black/60 lg:hidden" onClick={() => setAberto(false)}>
          <div role="dialog" aria-modal="true" aria-label="Mais páginas" onClick={e => e.stopPropagation()}
            className="absolute inset-x-0 bottom-0 max-h-[75dvh] overflow-y-auto rounded-t-2xl border-t border-line bg-surface p-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
            <div className="grid grid-cols-2 gap-2">{outros.map(([nome, href]) => (
              <Link key={href} href={href} aria-current={ativo(path, href) ? 'page' : undefined}
                className={`rounded-xl px-4 py-3 text-sm ${ativo(path, href) ? 'bg-brand/15 text-brand' : 'bg-line/40'}`}>{nome}</Link>))}</div>
          </div>
        </div>)}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
        {ITENS.filter(([, h]) => PRINCIPAIS.includes(h)).map(([nome, href]) => (
          <Link key={href} href={href} aria-current={ativo(path, href) ? 'page' : undefined} className={aba(ativo(path, href))}>{nome}</Link>))}
        <button onClick={() => setAberto(a => !a)} aria-expanded={aberto} className={aba(aberto || noMais)}>Mais</button>
      </nav>
    </>
  )
}
