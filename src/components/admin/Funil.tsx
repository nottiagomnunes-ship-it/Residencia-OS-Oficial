import type { Etapa } from '@/lib/engine/funil'

type Funil = { total: number; etapas: Etapa[] }

/** Barras do funil de primeiros passos (Administração → Pendências). Só números, nenhum dado de conta. */
export default function FunilPrimeirosPassos({ dados }: { dados: { geral: Funil; semana: Funil } | null }) {
  return (
    <section aria-labelledby="funil" className="space-y-4 rounded-2xl border border-line bg-surface p-5">
      <div><h2 id="funil" className="font-medium">Primeiros passos das contas</h2>
        <p className="text-sm text-muted">Onde as pessoas param no começo. Só contagens; a sua conta não entra.</p></div>
      {!dados ? <p className="text-sm text-warn">Não foi possível ler os números. Confira se a <code>SUPABASE_SERVICE_ROLE_KEY</code> está configurada na Vercel.</p>
        : !dados.geral.total ? <p className="text-sm text-muted">Ainda não há contas além da sua.</p>
        : <>
          <ol className="space-y-3">{dados.geral.etapas.map((e, i) => (
            <li key={e.rotulo} className="space-y-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span><b className="font-medium">{e.rotulo}</b> <span className="text-muted">· {e.dica}</span></span>
                <span><b className="text-lg">{e.n}</b>{e.pctTotal != null && <span className="text-muted"> ({e.pctTotal}%)</span>}</span>
              </div>
              <div className="h-2 rounded-full bg-line" aria-hidden><div className="h-2 rounded-full bg-brand" style={{ width: `${e.pctTotal ?? 0}%` }} /></div>
              {i > 0 && e.pctAnterior != null && e.pctAnterior < 60 && <p className="text-xs text-warn">Só {e.pctAnterior}% passaram da etapa anterior para esta.</p>}
            </li>))}</ol>
          <p className="text-sm text-muted">Contas criadas nos últimos 7 dias: <b className="text-ink">{dados.semana.total}</b>
            {dados.semana.total > 0 && <> · {dados.semana.etapas.map(e => e.n).join(' → ')}</>}</p>
        </>}
    </section>)
}
