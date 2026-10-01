import { supabaseServer } from '@/lib/supabase/server'
import { registrarSimulado, excluirSimulado } from '@/lib/simulados'
import { hojeBR } from '@/lib/dates'
import { resumoSimulados } from '@/lib/engine/simulados'
import { pct } from '@/lib/engine/desempenho'
import { fmtData, inputCls } from '@/components/ui'
import EvolucaoSimulados from '@/components/EvolucaoSimulados'

export default async function Simulados({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { ok, erro } = await searchParams
  const sb = await supabaseServer()
  const [{ data: ds }, { data: ms }] = await Promise.all([
    sb.from('disciplines').select('id,nome').order('ordem'),
    sb.from('mock_exams').select('id,nome,data,total,acertos,tempo_min,por_disciplina').order('data'),
  ])
  const r = resumoSimulados((ms ?? []) as any[]), extra = new Map((ms ?? []).map((m: any) => [m.id, m]))
  const [t, a] = (ok ?? '').split('-').map(Number)
  const card = (l: string, v: string) => <div className="rounded-2xl border border-line bg-surface p-4"><p className="text-sm text-muted">{l}</p><p className="mt-1 text-2xl font-semibold">{v}</p></div>
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Simulados</h1>
      {ok && t > 0 && <p role="status" className="rounded-xl border border-brand/40 bg-brand/10 p-4 text-sm">Simulado registrado: {a}/{t} ({pct(a, t)}%). As questões já entram no Desempenho.</p>}
      {erro && <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger">{erro}</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {card('Simulados feitos', String(r.itens.length))}{card('Média de acerto', r.media == null ? '—' : `${r.media}%`)}
        {card('Melhor resultado', r.melhor == null ? '—' : `${r.melhor}%`)}{card('Último', r.itens.length ? `${r.itens.at(-1)!.pct}%` : '—')}
      </div>
      <form action={registrarSimulado} className="grid gap-3 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-2 xl:grid-cols-4">
        <h2 className="font-medium sm:col-span-2 xl:col-span-4">Registrar simulado</h2>
        <input name="nome" required placeholder="Nome (ex.: Simulado 3)" className={inputCls + ' xl:col-span-2'} />
        <input name="data" type="date" defaultValue={hojeBR()} aria-label="Data" className={inputCls} />
        <input name="tempo_min" type="number" min={0} placeholder="Tempo (min)" className={inputCls} />
        <input name="total" type="number" min={1} placeholder="Questões (total)" className={inputCls} />
        <input name="acertos" type="number" min={0} placeholder="Acertos (total)" className={inputCls} />
        <p className="self-center text-xs text-muted sm:col-span-2">Ou informe por disciplina abaixo: o total é somado automaticamente.</p>
        <div className="grid gap-2 sm:col-span-2 xl:col-span-4 sm:grid-cols-2 xl:grid-cols-3">
          {(ds ?? []).map(d => (
            <fieldset key={d.id} className="flex items-center gap-2 rounded-xl border border-line p-2 text-sm"><legend className="sr-only">{d.nome}</legend>
              <span className="min-w-0 flex-1 truncate">{d.nome}</span>
              <input name={`q_${d.id}`} type="number" min={0} placeholder="Quest." aria-label={`${d.nome}: questões`} className={inputCls + ' w-20'} />
              <input name={`a_${d.id}`} type="number" min={0} placeholder="Acertos" aria-label={`${d.nome}: acertos`} className={inputCls + ' w-20'} /></fieldset>))}
        </div>
        <button className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-black sm:col-span-2 xl:col-span-4">Registrar simulado</button>
      </form>
      {r.itens.length > 1 && <EvolucaoSimulados dados={r.itens.map(i => ({ nome: i.nome, pct: i.pct }))} />}
      <ul className="space-y-3">{[...r.itens].reverse().map(i => { const m: any = extra.get(i.id); const linhas: any[] = m?.por_disciplina ?? []; return (
        <li key={i.id} className="space-y-2 rounded-2xl border border-line bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium">{i.nome} <span className="text-sm font-normal text-muted">{fmtData(i.data)}{m?.tempo_min ? ` · ${m.tempo_min} min` : ''}</span></span>
            <span className="text-sm">{i.acertos}/{i.total} · <b className={i.pct >= 75 ? 'text-brand' : i.pct >= 65 ? 'text-warn' : 'text-danger'}>{i.pct}%</b>
              {i.variacao != null && <span className={`ml-2 ${i.variacao >= 0 ? 'text-brand' : 'text-danger'}`}>{i.variacao >= 0 ? '▲' : '▼'} {Math.abs(i.variacao)} pts</span>}</span>
          </div>
          {linhas.length > 0 && <details className="text-sm"><summary className="cursor-pointer text-muted">Por disciplina</summary>
            <ul className="mt-2 space-y-1">{linhas.map(l => <li key={l.discipline_id} className="flex justify-between"><span>{l.nome}</span><span>{l.acertos}/{l.total} · {pct(l.acertos, l.total)}%</span></li>)}</ul></details>}
          <form action={excluirSimulado}><input type="hidden" name="id" value={i.id} /><button className="text-sm text-danger hover:underline">Excluir</button></form>
        </li>) })}</ul>
      {!r.itens.length && <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">Nenhum simulado registrado ainda.</p>}
    </div>
  )
}
