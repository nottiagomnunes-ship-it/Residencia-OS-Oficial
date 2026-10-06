import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import { carregarDesempenho } from '@/lib/desempenho-data'
import { hojeBR } from '@/lib/dates'
import { pct } from '@/lib/engine/desempenho'
import { Bar } from '@/components/ui'
import Graficos from '@/components/Graficos'
import { ResumoPorArea } from '@/components/ResumoPorArea'
import { carregarAreas } from '@/lib/areas-data'
import { areaDeMenorAcerto, resumoPorArea, SIGLA_AREA } from '@/lib/engine/areas'
import { carregarTemas } from '@/lib/banco-data'
import { desempenhoPorTema } from '@/lib/engine/temas'

const corAcerto = (p: number | null) => (p == null ? 'var(--c-muted)' : p >= 75 ? 'var(--c-brand)' : p >= 65 ? 'var(--c-warn)' : 'var(--c-danger)')

export default async function Desempenho() {
  const sb = await supabaseServer()
  const [d, areas, temas, { data: feitas }] = await Promise.all([carregarDesempenho(sb, hojeBR()), carregarAreas(sb), carregarTemas(sb),
    sb.from('banco_questoes').select('tema_id,vezes,acertos').gt('vezes', 0).not('tema_id', 'is', null).limit(20000)]) // sem a 0040: vazio
  const porTema = desempenhoPorTema((feitas ?? []) as { tema_id: string; vezes: number; acertos: number }[], temas)
  const porArea = areas.disponivel ? resumoPorArea(d.disciplinas.map(x => ({ area: areas.mapa[x.id] ?? null, total: x.total, acertos: x.acertos }))) : null
  const nenhumaOrganizada = d.disciplinas.length > 0 && d.disciplinas.every(x => !areas.mapa[x.id])
  const geral = pct(d.acertos, d.total)
  const card = (l: string, v: string) => <div className="rounded-2xl border border-line bg-surface p-4"><p className="text-sm text-muted">{l}</p><p className="mt-1 text-2xl font-semibold">{v}</p></div>
  const fracos = d.assuntos.filter(a => a.pct != null && a.total >= 10).sort((x, y) => x.pct! - y.pct!).slice(0, 8).map(a => ({ nome: a.nome, pct: a.pct! }))
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Desempenho</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {card('Total de questões', String(d.total))}{card('Aproveitamento', geral == null ? '—' : `${geral}%`)}{card('Acertos', String(d.acertos))}{card('Erros', String(d.total - d.acertos))}
      </div>
      {d.recomendacoes.length > 0 && (
        <section className="space-y-2 rounded-2xl border border-warn/40 bg-warn/10 p-5">
          <h2 className="font-medium text-warn">Recomendações</h2>
          {d.recomendacoes.map(r => <p key={r.disciplina} className="text-sm">{r.texto}</p>)}
        </section>)}
      {porArea && <ResumoPorArea resumos={porArea} menor={areaDeMenorAcerto(porArea)} nenhumaOrganizada={nenhumaOrganizada} />}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-3 rounded-2xl border border-line bg-surface p-5">
          <h2 className="font-medium">Por disciplina</h2>
          {d.disciplinas.map(x => (
            <Link key={x.id} href={`/disciplinas/${x.id}`} className="block space-y-1.5">
              <div className="flex justify-between text-sm"><span>{x.nome}{areas.mapa[x.id] && <span className="ml-2 text-xs text-muted">{SIGLA_AREA[areas.mapa[x.id]!]}</span>}</span><span style={{ color: corAcerto(x.pct) }}>{x.pct == null ? 'sem questões' : `${x.pct}%`}</span></div>
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
      {porTema.length > 0 && <section className="space-y-3 rounded-2xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-medium">Banco de questões por tema</h2>
          <span className="text-xs text-muted">menor acerto primeiro · conta cada tentativa</span></div>
        <ul className="space-y-2">{porTema.slice(0, 10).map(t => (
          <li key={t.id}><Link href={`/banco/praticar?assunto=${encodeURIComponent(`tema:${t.id}`)}`} className="block space-y-1.5 hover:text-brand">
            <div className="flex justify-between gap-2 text-sm"><span>{t.nome} <span className="text-xs text-muted">· {t.especialidade}</span></span>
              <span style={{ color: corAcerto(t.feitas >= 5 ? t.pct : null) }}>{t.pct}% <span className="text-xs text-muted">({t.acertos}/{t.feitas})</span></span></div>
            <Bar pct={t.pct} cor={corAcerto(t.feitas >= 5 ? t.pct : null)} />
          </Link></li>))}</ul>
        {porTema.length > 10 && <details className="text-sm"><summary className="cursor-pointer text-muted">Ver os outros {porTema.length - 10} temas</summary>
          <ul className="mt-2 divide-y divide-line">{porTema.slice(10).map(t => <li key={t.id} className="flex justify-between gap-2 py-1.5"><span>{t.nome} <span className="text-xs text-muted">· {t.especialidade}</span></span><span className="text-muted">{t.pct}% ({t.acertos}/{t.feitas})</span></li>)}</ul></details>}
        <p className="text-xs text-muted">Toque num tema para praticar só ele.</p>
      </section>}
      <Graficos serie={d.serie} disciplinas={d.disciplinas.map(x => ({ nome: x.nome, progresso: x.progresso }))} assuntos={fracos} />
    </div>
  )
}
