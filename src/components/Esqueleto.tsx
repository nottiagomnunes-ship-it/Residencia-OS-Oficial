/** Blocos cinza com o desenho aproximado da página, que aparecem na hora enquanto os dados chegam. Só pulsam se a pessoa não pediu menos movimento. */
const Bloco = ({ className = '' }: { className?: string }) => <div aria-hidden className={`rounded-xl bg-line/60 motion-safe:animate-pulse ${className}`} />

/** Avisa leitores de tela que a página está carregando (o desenho em si é só visual). */
export function Carregando({ children }: { children: React.ReactNode }) {
  return <div role="status" aria-busy="true" aria-live="polite" className="space-y-6"><span className="sr-only">Carregando…</span>{children}</div>
}

const Titulo = () => <div className="space-y-2"><Bloco className="h-8 w-56 max-w-full" /><Bloco className="h-4 w-80 max-w-full" /></div>

/** Padrão para a maioria das páginas: título, três cartões e uma lista. */
export function EsqueletoPagina() {
  return (
    <Carregando>
      <Titulo />
      <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map(k => <Bloco key={k} className="h-28" />)}</div>
      <div className="space-y-3">{[0, 1, 2, 3].map(k => <Bloco key={k} className="h-16" />)}</div>
    </Carregando>)
}

/** Início: o painel de hoje e os cartões de progresso. */
export function EsqueletoInicio() {
  return (
    <Carregando>
      <Titulo />
      <Bloco className="h-12" />
      <div className="space-y-3 rounded-2xl border border-line bg-surface p-5">
        <Bloco className="h-6 w-24" /><Bloco className="h-3" /><Bloco className="h-10 w-2/3" />{[0, 1, 2].map(k => <Bloco key={k} className="h-14" />)}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(k => <Bloco key={k} className="h-36" />)}</div>
    </Carregando>)
}

/** Calendário: o título, a barra de ferramentas e a grade de dias. */
export function EsqueletoCalendario() {
  return (
    <Carregando>
      <div className="flex flex-wrap items-center justify-between gap-3"><Bloco className="h-8 w-48" /><Bloco className="h-11 w-56" /></div>
      <Bloco className="h-14" />
      <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
        {Array.from({ length: 7 }, (_, d) => (
          <div key={d} className="space-y-2 rounded-xl border border-line p-2"><Bloco className="mx-auto h-10 w-16" />{Array.from({ length: d % 3 + 1 }, (_, k) => <Bloco key={k} className="h-14" />)}</div>))}
      </div>
    </Carregando>)
}
