'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { INICIO, GRUPOS, RODAPE, PAGINAS_DO_MENU, PRINCIPAIS, ativo, type ItemMenu } from '@/lib/engine/menu'

/** Guarda a escolha (menu recolhido ou aberto) neste aparelho. Vai em cookie para o servidor já desenhar o menu certo, sem piscar. */
const guardarMenu = (recolhido: boolean) => { document.cookie = `menu=${recolhido ? 'recolhido' : 'aberto'}; path=/; max-age=31536000; SameSite=Lax` }
// título de seção: pequeno, em maiúsculas espaçadas e com uma linha ao lado. Parece um rótulo, não um botão (os itens clicáveis usam a cor clara do app)
const TITULO_GRUPO = 'flex select-none items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted'
const Titulo = ({ texto, recuo }: { texto: string; recuo: string }) => <p aria-hidden className={`${TITULO_GRUPO} ${recuo}`}><span>{texto}</span><span aria-hidden className="h-px flex-1 bg-line" /></p>

/**
 * Menu lateral (telas largas), em grupos, com Configurações no rodapé. O botão ‹ recolhe tudo para uma faixa fina com um ☰, que abre o menu por cima
 * (como uma gaveta) para navegar. "Fixar o menu" na gaveta volta ao menu sempre aberto. A escolha fica lembrada neste aparelho.
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
  const link = ([nome, href]: ItemMenu) => (
    <Link key={href} href={href} aria-current={ativo(path, href) ? 'page' : undefined}
      className={`rounded-xl px-3 py-2 text-sm transition-colors ${ativo(path, href) ? 'bg-brand/15 text-brand' : 'hover:bg-line/50'}`}>{nome}</Link>)
  const lista = (
    <>
      {link(INICIO)}
      {GRUPOS.map(g => (
        <div key={g.titulo} role="group" aria-label={g.titulo} className="mt-5 flex flex-col gap-1">
          <Titulo texto={g.titulo} recuo="px-3" />{g.itens.map(link)}
        </div>))}
      <div className="mt-auto flex flex-col gap-1 border-t border-line pt-3">{RODAPE.map(link)}</div>
    </>)
  const botao = 'grid size-11 shrink-0 place-items-center rounded-xl text-lg text-muted hover:bg-line/50 hover:text-brand'

  if (recolhido) return (
    <>
      <aside className="sticky top-0 hidden h-screen w-14 shrink-0 flex-col items-center border-r border-line bg-surface py-3 lg:flex">
        <button onClick={() => setGaveta(true)} aria-label="Abrir menu" aria-expanded={gaveta} title="Abrir menu" className={botao}>☰</button>
      </aside>
      {gaveta && (
        <div className="fixed inset-0 z-50 hidden bg-black/60 lg:block" onClick={() => setGaveta(false)}>
          <nav role="dialog" aria-modal="true" aria-label="Menu" onClick={e => e.stopPropagation()} className="flex h-full w-64 flex-col gap-1 overflow-y-auto border-r border-line bg-surface p-4">
            <div className="mb-4 flex items-center justify-between px-3"><span className="text-lg font-semibold text-brand">Residência OS</span>
              <button onClick={() => setGaveta(false)} aria-label="Fechar menu" className="p-2 text-muted hover:text-brand">✕</button></div>
            {lista}
            <button onClick={() => { definir(false); setGaveta(false) }} className="mt-3 rounded-xl border border-line px-3 py-2 text-sm text-muted hover:border-brand">Fixar o menu</button>
          </nav>
        </div>)}
    </>
  )
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-1 overflow-y-auto border-r border-line bg-surface p-4 lg:flex">
      <div className="mb-4 flex items-center justify-between pl-3">
        <span className="text-lg font-semibold text-brand">Residência OS</span>
        <button onClick={() => definir(true)} aria-label="Recolher menu" title="Recolher menu" className={botao + ' -my-1'}>‹</button>
      </div>
      {lista}
    </aside>
  )
}

/** Celular e tablet em pé: quatro abas fixas e "Mais", que abre o resto em grupos. */
export function BottomNav() {
  const path = usePathname(), [aberto, setAberto] = useState(false)
  useEffect(() => setAberto(false), [path])
  const abas = PRINCIPAIS.map(h => PAGINAS_DO_MENU.find(([, x]) => x === h)!)
  const grupos = GRUPOS.map(g => ({ titulo: g.titulo, itens: g.itens.filter(([, h]) => !PRINCIPAIS.includes(h)) })).filter(g => g.itens.length)
  const noMais = [...grupos.flatMap(g => g.itens), ...RODAPE].some(([, h]) => ativo(path, h))
  const aba = (on: boolean) => `flex min-h-14 flex-1 items-center justify-center text-xs ${on ? 'text-brand' : 'text-muted'}`
  const cartao = ([nome, href]: ItemMenu) => (
    <Link key={href} href={href} aria-current={ativo(path, href) ? 'page' : undefined}
      className={`rounded-xl px-4 py-3 text-sm ${ativo(path, href) ? 'bg-brand/15 text-brand' : 'bg-line/40'}`}>{nome}</Link>)
  return (
    <>
      {aberto && (
        <div className="fixed inset-0 z-20 bg-black/60 lg:hidden" onClick={() => setAberto(false)}>
          <div role="dialog" aria-modal="true" aria-label="Mais páginas" onClick={e => e.stopPropagation()}
            className="absolute inset-x-0 bottom-0 max-h-[75dvh] space-y-4 overflow-y-auto rounded-t-2xl border-t border-line bg-surface p-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
            {grupos.map(g => (
              <div key={g.titulo} role="group" aria-label={g.titulo} className="space-y-2">
                <Titulo texto={g.titulo} recuo="px-1" />
                <div className="grid grid-cols-2 gap-2">{g.itens.map(cartao)}</div>
              </div>))}
            <div className="border-t border-line pt-3"><div className="grid grid-cols-2 gap-2">{RODAPE.map(cartao)}</div></div>
          </div>
        </div>)}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
        {abas.map(([nome, href]) => (
          <Link key={href} href={href} aria-current={ativo(path, href) ? 'page' : undefined} className={aba(ativo(path, href))}>{nome}</Link>))}
        <button onClick={() => setAberto(a => !a)} aria-expanded={aberto} className={aba(aberto || noMais)}>Mais</button>
      </nav>
    </>
  )
}
