import Link from 'next/link'
import { Bar } from '@/components/ui'
import { COR_AREA, type ResumoDeArea } from '@/lib/engine/areas'

const corAcerto = (p: number | null) => (p == null ? '#8A9A93' : p >= 75 ? '#22C55E' : p >= 65 ? '#F59E0B' : '#EF4444')   // as mesmas faixas do "Por disciplina"

/** Aproveitamento nas 5 áreas da prova, de relance. Sem nenhuma disciplina em uma área, convida a organizar em vez de mostrar números vazios. */
export function ResumoPorArea({ resumos, menor, nenhumaOrganizada }: { resumos: ResumoDeArea[]; menor: ResumoDeArea | null; nenhumaOrganizada: boolean }) {
  if (nenhumaOrganizada) {
    return (
      <section className="rounded-2xl border border-line bg-surface p-5" aria-label="Por área">
        <h2 className="font-medium">Por área</h2>
        <p className="mt-1 text-sm text-muted">Para ver o seu desempenho em Clínica Médica, Cirurgia, Pediatria, GO e Preventiva, <Link href="/disciplinas" className="text-brand underline">organize as disciplinas por área</Link>.</p>
      </section>)
  }
  return (
    <section className="space-y-3" aria-label="Por área">
      <h2 className="font-medium">Por área da prova</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {resumos.map(r => {
          const cor = r.area ? corAcerto(r.pct) : '#8A9A93'   // "Sem área" não é uma área da prova: sem verde/amarelo/vermelho, para não parecer uma área fraca
          return (
          <div key={r.rotulo} className="space-y-2 rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-center gap-2"><span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: r.area ? COR_AREA[r.area] : '#8A9A93' }} /><p className="text-sm text-muted">{r.rotulo}</p></div>
            <p className="text-2xl font-semibold" style={{ color: cor }}>{r.pct == null ? '—' : `${r.pct}%`}</p>
            <Bar pct={r.pct ?? 0} cor={cor} />
            <p className="text-xs text-muted">{r.total ? `${r.total} ${r.total === 1 ? 'questão' : 'questões'}` : 'sem questões ainda'} · {r.disciplinas} {r.disciplinas === 1 ? 'disciplina' : 'disciplinas'}</p>
          </div>)
        })}
      </div>
      {menor && <p className="text-sm text-muted">Menor aproveitamento até agora: <b className="font-medium text-[#E7EEEA]">{menor.rotulo}</b> ({menor.pct}%). Uma boa área para dar mais atenção nas próximas sessões.</p>}
    </section>)
}
