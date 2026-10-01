import { Bar, fmtData } from '@/components/ui'
import type { carregarGamificacao } from '@/lib/gamificacao-data'
type G = Awaited<ReturnType<typeof carregarGamificacao>>

export function NivelCard({ g }: { g: G }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-baseline justify-between"><h2 className="text-sm text-muted">Nível</h2><span className="text-sm text-muted">{g.xp} XP</span></div>
      <p className="mt-1 text-2xl font-semibold">{g.nivel.nivel} <span className="text-base font-normal text-muted">· {g.nivel.nome}</span></p>
      <div className="my-2"><Bar pct={g.nivel.pct} /></div>
      <p className="text-sm text-muted">Faltam {g.nivel.xpParaProximo} XP para o nível {g.nivel.nivel + 1}</p>
    </section>)
}
export function SequenciaCard({ g }: { g: G }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-sm text-muted">Sequência de estudo</h2>
      <p className="mt-1 text-2xl font-semibold">🔥 {g.sequencia.atual} {g.sequencia.atual === 1 ? 'dia' : 'dias'}</p>
      <p className="mt-2 text-sm text-muted">{g.sequencia.atual === 0 ? 'Estude hoje para começar uma sequência.' : `Melhor sequência: ${g.sequencia.melhor} dias`}</p>
    </section>)
}
export function ConquistasGrid({ g }: { g: G }) {
  const n = g.conquistas.filter(c => c.em).length
  return (
    <section className="space-y-3"><h2 className="font-medium">Conquistas <span className="text-sm font-normal text-muted">{n} de {g.conquistas.length}</span></h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[...g.conquistas].sort((a, b) => Number(!!b.em) - Number(!!a.em)).map(c => (
        <div key={c.codigo} className={`rounded-2xl border p-4 ${c.em ? 'border-brand/40 bg-brand/5' : 'border-line bg-surface opacity-60'}`}>
          <p className="font-medium">{c.em ? '🏅 ' : ''}{c.titulo}{c.em && !c.visto && <span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-xs font-normal text-black">Nova</span>}</p><p className="text-sm text-muted">{c.descricao}</p>
          {c.em && <p className="mt-1 text-xs text-brand">Desbloqueada em {fmtData(c.em.slice(0, 10))}</p>}
        </div>))}</div></section>)
}
