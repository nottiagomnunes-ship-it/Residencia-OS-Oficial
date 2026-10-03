import Link from 'next/link'
import { Bar } from '@/components/ui'
import { COR_AREA, type Area, type GrupoDeArea } from '@/lib/engine/areas'

export type CartaoDisciplina = { id: string; nome: string; cor: string; peso: number; ok: number; total: number; area: Area | null }
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

function Cartao({ d }: { d: CartaoDisciplina }) {
  const pct = d.total ? Math.round((d.ok / d.total) * 100) : 0
  return (
    <Link href={`/disciplinas/${d.id}`} className="space-y-3 rounded-2xl border border-line bg-surface p-5 hover:border-brand/50">
      <div className="flex items-center justify-between"><h3 className="font-medium">{d.nome}</h3><span className="text-xs text-muted">peso {d.peso}</span></div>
      <Bar pct={pct} cor={d.cor} />
      <p className="text-sm text-muted">{d.ok}/{d.total} conteúdos concluídos · {pct}%</p>
    </Link>)
}

/** As disciplinas em blocos por área (cada um com o progresso dos assuntos). Sem áreas disponíveis, a grade simples de antes. */
export function DisciplinasPorArea({ grupos }: { grupos: GrupoDeArea<CartaoDisciplina>[] }) {
  return (
    <div className="space-y-8">
      {grupos.map(g => {
        const total = g.itens.reduce((s, d) => s + d.total, 0), ok = g.itens.reduce((s, d) => s + d.ok, 0), pct = total ? Math.round((ok / total) * 100) : 0
        return (
          <section key={g.rotulo} aria-label={g.rotulo} className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line pb-2">
              <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: g.area ? COR_AREA[g.area] : '#8A9A93' }} />
              <h2 className="text-lg font-semibold">{g.rotulo}</h2>
              <p className="text-sm text-muted">{plural(g.itens.length, 'disciplina', 'disciplinas')}{total ? ` · ${ok} de ${total} assuntos concluídos (${pct}%)` : ''}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{g.itens.map(d => <Cartao key={d.id} d={d} />)}</div>
          </section>)
      })}
    </div>)
}
export function DisciplinasSimples({ itens }: { itens: CartaoDisciplina[] }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{itens.map(d => <Cartao key={d.id} d={d} />)}</div>
}
