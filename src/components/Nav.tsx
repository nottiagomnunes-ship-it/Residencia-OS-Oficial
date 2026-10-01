'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export const ITENS = [
  ['Início', '/inicio'], ['Meu Cronograma', '/cronograma'], ['Calendário', '/calendario'], ['Revisões', '/revisoes'],
  ['Questões', '/questoes'], ['Desempenho', '/desempenho'], ['Caderno de Erros', '/caderno-de-erros'], ['Simulados', '/simulados'],
  ['Disciplinas', '/disciplinas'], ['Conteúdos', '/conteudos'], ['Metas', '/metas'], ['Configurações', '/configuracoes'],
] as const
const PRINCIPAIS = ['/inicio', '/calendario', '/revisoes', '/questoes', '/desempenho']

export function Sidebar() {
  const path = usePathname()
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-1 border-r border-line bg-surface p-4 md:flex">
      <div className="mb-6 px-3 text-lg font-semibold text-brand">Residência OS</div>
      {ITENS.map(([nome, href]) => (
        <Link key={href} href={href} aria-current={path === href ? 'page' : undefined}
          className={`rounded-xl px-3 py-2 text-sm ${path === href ? 'bg-brand/15 text-brand' : 'text-muted hover:bg-line/50'}`}>{nome}</Link>))}
    </aside>
  )
}

export function BottomNav() {
  const path = usePathname()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-line bg-surface md:hidden">
      {ITENS.filter(([, h]) => PRINCIPAIS.includes(h)).map(([nome, href]) => (
        <Link key={href} href={href} className={`flex-1 py-3 text-center text-xs ${path === href ? 'text-brand' : 'text-muted'}`}>{nome}</Link>))}
    </nav>
  )
}
