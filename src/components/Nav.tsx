'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SECOES, AJUSTES, ADMIN, secaoDe, abaDe, dentro, type Icone as NomeIcone, type Secao } from '@/lib/engine/menu'

/** Guarda a escolha (menu recolhido ou aberto) neste aparelho. Vai em cookie para o servidor já desenhar o menu certo, sem piscar. */
const guardarMenu = (recolhido: boolean) => { document.cookie = `menu=${recolhido ? 'recolhido' : 'aberto'}; path=/; max-age=31536000; SameSite=Lax` }

const CAMINHOS: Record<NomeIcone, string> = {
  hoje: 'M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5',
  agenda: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  questoes: 'M5 4h11l3 3v13H5zM9 12l2 2 4-4',
  materias: 'M4 5c3-1 5-1 8 1 3-2 5-2 8-1v14c-3-1-5-1-8 1-3-2-5-2-8-1zM12 6v14',
  progresso: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  mensagem: 'M4 5h16v11H9l-5 4zM8 9h8M8 12h5',
  admin: 'M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6zM9 12l2 2 4-4',
  ajustes: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
}
export function Icone({ nome, className = 'size-5' }: { nome: NomeIcone; className?: string }) {
  return <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}><path d={CAMINHOS[nome]} /></svg>
}

/**
 * Menu lateral (telas largas): as 5 seções e, no rodapé, Configurações, Ajuda e Sugestões. O botão ‹ recolhe o menu para uma faixa só com os ícones.
 * A escolha fica lembrada neste aparelho.
 */
export function Sidebar({ recolhidoInicial = false, admin = false }: { recolhidoInicial?: boolean; admin?: boolean }) {
  const path = usePathname(), atual = secaoDe(path)
  const [recolhido, setRecolhido] = useState(recolhidoInicial)
  const definir = (v: boolean) => { setRecolhido(v); guardarMenu(v) }
  const item = (s: Secao, rotulo = s.nome, href = s.href, ativo = atual === s) => (
    <Link key={href} href={href} aria-current={ativo ? 'page' : undefined} title={recolhido ? rotulo : undefined} aria-label={recolhido ? rotulo : undefined}
      className={`flex items-center gap-3 rounded-xl text-sm transition-colors ${recolhido ? 'size-11 justify-center' : 'px-3 py-2.5'} ${ativo ? 'bg-brand/15 text-brand' : 'hover:bg-line/50'}`}>
      <Icone nome={s.icone} />{!recolhido && <span>{rotulo}</span>}</Link>)
  const rodape = AJUSTES.abas.map(([nome, href]) => (
    <Link key={href} href={href} aria-current={abaDe(path, AJUSTES) === href ? 'page' : undefined} title={recolhido ? nome : undefined} aria-label={recolhido ? nome : undefined}
      className={`flex items-center gap-3 rounded-xl text-sm ${recolhido ? 'size-11 justify-center' : 'px-3 py-2'} ${abaDe(path, AJUSTES) === href ? 'bg-brand/15 text-brand' : 'text-muted hover:bg-line/50 hover:text-inherit'}`}>
      {href === '/ajuda' ? <span aria-hidden className="grid size-5 place-items-center rounded-full border border-current text-xs">?</span> : href === '/contato' ? <Icone nome="mensagem" /> : <Icone nome="ajustes" />}{!recolhido && <span>{nome}</span>}</Link>))
  return (
    <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col gap-1 overflow-y-auto border-r border-line bg-surface lg:flex ${recolhido ? 'w-16 items-center p-2.5' : 'w-60 p-4'}`}>
      <div className={`mb-4 flex items-center ${recolhido ? 'justify-center' : 'justify-between pl-3'}`}>
        {!recolhido && <span className="text-lg font-semibold text-brand">R1TMO</span>}
        <button onClick={() => definir(!recolhido)} aria-label={recolhido ? 'Abrir menu' : 'Recolher menu'} title={recolhido ? 'Abrir menu' : 'Recolher menu'}
          className="grid size-11 shrink-0 place-items-center rounded-xl text-lg text-muted hover:bg-line/50 hover:text-brand">{recolhido ? '›' : '‹'}</button>
      </div>
      <nav aria-label="Seções" className="flex flex-col gap-1">{SECOES.map(s => item(s))}</nav>
      <div className="mt-auto flex flex-col gap-1 border-t border-line pt-3">{admin && item(ADMIN, ADMIN.nome, ADMIN.href, atual === ADMIN)}{rodape}</div>
    </aside>)
}

/** Celular e tablet em pé: as 5 seções fixas na barra de baixo (Configurações e Ajuda ficam no topo da página, na engrenagem). */
export function BottomNav() {
  const path = usePathname(), atual = secaoDe(path)
  return (
    <nav aria-label="Seções" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
      {SECOES.map(s => (
        <Link key={s.href} href={s.href} aria-current={atual === s ? 'page' : undefined}
          className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[0.6875rem] ${atual === s ? 'text-brand' : 'text-muted'}`}>
          <Icone nome={s.icone} className="size-5" />{s.nome}</Link>))}
    </nav>)
}

/**
 * Topo da página: as abas da seção atual (ex.: Agenda → Calendário · Plano de estudo · Meu tempo · Compromissos) e, no celular,
 * a engrenagem (Configurações) e a Ajuda. Seção de uma aba só não mostra abas.
 */
export function SubNav({ admin = false }: { admin?: boolean }) {
  const path = usePathname(), s = secaoDe(path), aba = s ? abaDe(path, s) : null
  useEffect(() => { document.getElementById('aba-atual')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }) }, [path])
  const extras = (
    <div className="ml-auto flex shrink-0 items-center gap-1">
      {admin && <Link href="/admin" aria-label="Administração" aria-current={dentro(path, '/admin') ? 'page' : undefined} className={`grid size-11 place-items-center rounded-xl hover:text-brand ${dentro(path, '/admin') ? 'text-brand' : 'text-muted'}`}><Icone nome="admin" /></Link>}
      <Link href="/ajuda" aria-label="Ajuda" className="grid size-11 place-items-center rounded-xl text-muted hover:text-brand"><span aria-hidden className="grid size-5 place-items-center rounded-full border border-current text-xs">?</span></Link>
      <Link href="/configuracoes" aria-label="Configurações" className="grid size-11 place-items-center rounded-xl text-muted hover:text-brand"><Icone nome="ajustes" /></Link>
    </div>)
  // no celular: uma linha com o nome da seção e os atalhos (Ajuda, Configurações); embaixo, as abas com a largura toda
  const topoCelular = <div className="-mt-2 mb-1 flex items-center lg:hidden"><span className="text-sm font-semibold uppercase tracking-wide text-muted">{s?.nome ?? ''}</span>{extras}</div>
  if (!s || s.abas.length < 2) return topoCelular
  return (
    <div className="mb-5">
      {topoCelular}
      <nav aria-label={`Abas de ${s.nome}`} className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 md:mx-0 md:px-0">
        {s.abas.map(([nome, href]) => (
          <Link key={href} id={aba === href ? 'aba-atual' : undefined} href={href} aria-current={aba === href ? 'page' : undefined}
            className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-2.5 py-2.5 text-sm md:px-3 ${aba === href ? 'border-brand font-medium text-brand' : 'border-transparent text-muted hover:text-inherit'}`}>{nome}</Link>))}
      </nav>
    </div>)
}
