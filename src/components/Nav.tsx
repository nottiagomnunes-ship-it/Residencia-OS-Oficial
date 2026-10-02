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

/** Guarda a escolha (menu recolhido ou aberto) neste aparelho. Vai em cookie para o servidor já desenhar o menu certo, sem piscar. */
const guardarMenu = (recolhido: boolean) => { document.cookie = `menu=${recolhido ? 'recolhido' : 'aberto'}; path=/; max-age=31536000; SameSite=Lax` }

/**
 * Menu lateral (telas largas). O botão ‹ recolhe tudo para uma faixa fina com um ☰, que abre o menu por cima (como uma gaveta) para navegar.
 * "Fixar o menu" na gaveta volta ao menu sempre aberto. A escolha fica lembrada neste aparelho.
 */
export function Sidebar({ recolhidoInicial = false }: { recolhidoInicial?: boolean }) {
  const path = usePathname()
  const [recolhido, setRecolhido] = useState(recolhidoInicial), [gaveta, setGaveta] = useState(false)
  const definir = (v: boolean) => { setRecolhido(v); guardarMenu(v) }
  useEffect(() => setGaveta(false), [path])   // escolheu uma página: a gaveta fecha
  useEffect(() => {
    if (!gaveta) return
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') setGaveta(false) }
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f)
  }, [gaveta])
  const links = ITENS.map(([nome, href]) => (
    <Link key={href} href={href} aria-current={ativo(path, href) ? 'page' : undefined}
      className={`rounded-xl px-3 py-2 text-sm ${ativo(path, href) ? 'bg-brand/15 text-brand' : 'text-muted hover:bg-line/50'}`}>{nome}</Link>))
  const botao = 'grid size-11 shrink-0 place-items-center rounded-xl text-lg text-muted hover:bg-line/50 hover:text-brand'

  if (recolhido) return (
    <>
      <aside className="sticky top-0 hidden h-screen w-14 shrink-0 flex-col items-center border-r border-line bg-surface py-3 lg:flex">
        <button onClick={() => setGaveta(true)} aria-label="Abrir menu" aria-expanded={gaveta} title="Abrir menu" className={botao}>☰</button>
      </aside>
      {gaveta && (
        <div className="fixed inset-0 z-50 hidden bg-black/60 lg:block" onClick={() => setGaveta(false)}>
          <nav role="dialog" aria-modal="true" aria-label="Menu" onClick={e => e.stopPropagation()} className="flex h-full w-64 flex-col gap-1 overflow-y-auto border-r border-line bg-surface p-4">
            <div className="mb-6 flex items-center justify-between px-3"><span className="text-lg font-semibold text-brand">Residência OS</span>
              <button onClick={() => setGaveta(false)} aria-label="Fechar menu" className="p-2 text-muted hover:text-brand">✕</button></div>
            {links}
            <button onClick={() => { definir(false); setGaveta(false) }} className="mt-4 rounded-xl border border-line px-3 py-2 text-sm text-muted hover:border-brand">Fixar o menu</button>
          </nav>
        </div>)}
    </>
  )
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-1 overflow-y-auto border-r border-line bg-surface p-4 lg:flex">
      <div className="mb-6 flex items-center justify-between pl-3">
        <span className="text-lg font-semibold text-brand">Residência OS</span>
        <button onClick={() => definir(true)} aria-label="Recolher menu" title="Recolher menu" className={botao + ' -my-1'}>‹</button>
      </div>
      {links}
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
