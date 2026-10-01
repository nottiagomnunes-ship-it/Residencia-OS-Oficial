import { supabaseServer } from '@/lib/supabase/server'
import { criarMeta, excluirMeta, metasDoPlano } from '@/lib/metas'
import { carregarGamificacao } from '@/lib/gamificacao-data'
import { ConquistasGrid } from '@/components/Gamificacao'
import { carregarMetas } from '@/lib/metas-data'
import { hojeBR } from '@/lib/dates'
import { METRICAS, PERIODOS, type Periodo, type Metrica } from '@/lib/engine/metas'
import { Bar, inputCls } from '@/components/ui'

export default async function Metas() {
  const sb = await supabaseServer(), hoje = hojeBR()
  const metas = await carregarMetas(sb, hoje), gam = await carregarGamificacao(sb, hoje)
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Metas</h1>
        <form action={metasDoPlano}><button className="rounded-xl border border-line px-4 py-2 text-sm hover:border-brand">Criar metas a partir do meu plano</button></form>
      </div>
      <form action={criarMeta} className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-5">
        <label className="space-y-1 text-sm"><span className="block">Período</span><select name="periodo" defaultValue="semana" className={inputCls}>{(Object.keys(PERIODOS) as Periodo[]).map(p => <option key={p} value={p}>{PERIODOS[p]}</option>)}</select></label>
        <label className="space-y-1 text-sm"><span className="block">Métrica</span><select name="metrica" defaultValue="questoes" className={inputCls}>{(Object.keys(METRICAS) as Metrica[]).map(m => <option key={m} value={m}>{METRICAS[m].rotulo}</option>)}</select></label>
        <label className="space-y-1 text-sm"><span className="block">Alvo</span><input name="alvo" type="number" min={1} required className={inputCls + ' w-28'} /></label>
        <button className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-black">Adicionar meta</button>
      </form>
      {(Object.keys(PERIODOS) as Periodo[]).map(p => { const l = metas.filter(m => m.periodo === p); return l.length ? (
        <section key={p} className="space-y-3"><h2 className="font-medium">{PERIODOS[p]}</h2>
          <div className="grid gap-4 md:grid-cols-2">{l.map(m => (
            <div key={m.id} className="space-y-2 rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-baseline justify-between"><span>{METRICAS[m.metrica].rotulo}</span><span className={m.pct >= 100 ? 'text-brand' : 'text-muted'}>{m.pct >= 100 ? 'Meta batida' : `${m.pct}%`}</span></div>
              <Bar pct={Math.min(100, m.pct)} cor={m.pct >= 100 ? '#22C55E' : '#3B82F6'} />
              <div className="flex items-center justify-between text-sm"><span className="text-muted">{m.valor} de {m.alvo} {METRICAS[m.metrica].unidade}</span>
                <form action={excluirMeta}><input type="hidden" name="id" value={m.id} /><button className="text-danger hover:underline">Excluir</button></form></div>
            </div>))}</div></section>) : null })}
      {!metas.length && <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">Nenhuma meta ainda. Crie uma acima ou use o botão para gerar metas diárias a partir do seu plano.</p>}
      <ConquistasGrid g={gam} />
    </div>
  )
}
