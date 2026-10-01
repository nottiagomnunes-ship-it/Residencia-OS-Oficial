import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import { carregarDesempenho } from '@/lib/desempenho-data'
import { hojeBR } from '@/lib/dates'
import { pct } from '@/lib/engine/desempenho'
import { Bar } from '@/components/ui'
import Graficos from '@/components/Graficos'

const corAcerto = (p: number | null) => (p == null ? '#8A9A93' : p >= 75 ? '#22C55E' : p >= 65 ? '#F59E0B' : '#EF4444')

export default async function Desempenho() {
  const d = await carregarDesempenho(await supabaseServer(), hojeBR())
  const geral = pct(d.acertos, d.total)
  const card = (l: string, v: string) => <div className="rounded-2xl border border-line bg-surface p-4"><p className="text-sm text-muted">{l}</p><p className="mt-1 text-2xl font-semibold">{v}</p></div>
  const fracos = d.assuntos.filter(a => a.pct != null && a.total >= 10).sort((x, y) => x.pct! - y.pct!).slice(0, 8).map(a => ({ nome: a.nome, pct: a.pct! }))
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Desempenho</h1>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {card('Total de questões', String(d.total))}{card('Aproveitamento', geral == null ? '—' : `${geral}%`)}{card('Acertos', String(d.acertos))}{card('Erros', String(d.total - d.acertos))}
      </div>
      {d.recomendacoes.length > 0 && (
        <section className="space-y-2 rounded-2xl border border-warn/40 bg-warn/10 p-5">
          <h2 className="font-medium text-warn">Recomendações</h2>
          {d.recomendacoes.map(r => <p key={r.disciplina} className="text-sm">{r.texto}</p>)}
        </section>)}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-3 rounded-2xl border border-line bg-surface p-5">
          <h2 className="font-medium">Por disciplina</h2>
          {d.disciplinas.map(x => (
            <Link key={x.id} href={`/disciplinas/${x.id}`} className="block space-y-1.5">
              <div className="flex justify-between text-sm"><span>{x.nome}</span><span style={{ color: corAcerto(x.pct) }}>{x.pct == null ? 'sem questões' : `${x.pct}%`}</span></div>
              <Bar pct={x.pct ?? 0} cor={corAcerto(x.pct)} />
            </Link>))}
        </section>
        <section className="space-y-3 rounded-2xl border border-line bg-surface p-5">
          <h2 className="font-medium">Oportunidades de foco</h2>
          {!d.foco.length && <p className="text-sm text-muted">Nenhum assunto pede atenção agora. Continue registrando questões para o sistema acompanhar.</p>}
          {d.foco.slice(0, 8).map(a => (
            <div key={a.id} className="space-y-0.5 text-sm">
              <p className={a.nivel === 'alta' ? 'text-danger' : 'text-warn'}>{a.nivel === 'alta' ? '🔴 Alta prioridade' : '🟡 Atenção'}</p>
              <p>{a.frase}</p>
            </div>))}
        </section>
      </div>
      <Graficos serie={d.serie} disciplinas={d.disciplinas.map(x => ({ nome: x.nome, progresso: x.progresso }))} assuntos={fracos} />
    </div>
  )
}
