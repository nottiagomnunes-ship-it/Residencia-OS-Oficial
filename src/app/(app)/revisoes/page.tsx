import { supabaseServer } from '@/lib/supabase/server'
import { concluirRevisao } from '@/lib/flow'
import { hojeBR } from '@/lib/dates'
import { addDays, diffDays, priorityScore } from '@/lib/engine/review'
import { fmtData, inputCls } from '@/components/ui'

export default async function Revisoes() {
  const sb = await supabaseServer()
  const hoje = hojeBR()
  await sb.from('schedule_items').update({ status: 'atrasado' }).in('status', ['agendado', 'proximo']).lt('data', hoje)
  const [{ data: rs }, { data: qs }] = await Promise.all([
    sb.from('reviews').select('id,numero,interval_days,due_date,topic_id,topics(nome,completed_date,disciplines(nome,peso,cor))').eq('status', 'pendente').order('due_date'),
    sb.from('question_sets').select('topic_id,total,acertos'),
  ])
  const acerto = new Map<string, number>()
  const agg = new Map<string, [number, number]>()
  for (const s of qs ?? []) { const a = agg.get(s.topic_id) ?? [0, 0]; agg.set(s.topic_id, [a[0] + s.total, a[1] + s.acertos]) }
  agg.forEach(([t, a], k) => acerto.set(k, Math.round((a / t) * 100)))

  const itens = ((rs ?? []) as any[]).map(r => {
    const atraso = Math.max(0, diffDays(r.due_date, hoje))
    return { ...r, atraso, score: priorityScore({ diasAtraso: atraso, acerto: acerto.get(r.topic_id) ?? null, peso: r.topics?.disciplines?.peso ?? 3, numero: r.numero }) }
  })
  const fila = (f: (r: any) => boolean) => itens.filter(f).sort((a, b) => b.score - a.score)
  const grupos = [
    { titulo: 'Atrasadas', cor: 'text-danger', lista: fila(r => r.due_date < hoje) },
    { titulo: 'Hoje', cor: 'text-info', lista: fila(r => r.due_date === hoje) },
    { titulo: 'Próximos 14 dias', cor: 'text-muted', lista: itens.filter(r => r.due_date > hoje && r.due_date <= addDays(hoje, 14)) },
  ]
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Revisões</h1>
      {!itens.length && <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">Nenhuma revisão pendente. Conclua um conteúdo em Conteúdos para gerar as primeiras.</p>}
      {grupos.filter(g => g.lista.length).map(g => (
        <section key={g.titulo} className="space-y-3">
          <h2 className={`font-medium ${g.cor}`}>{g.titulo} ({g.lista.length})</h2>
          {g.lista.map(r => (
            <details key={r.id} className="rounded-2xl border border-line bg-surface p-4">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                <span><span className="font-medium">{r.topics?.nome}</span>
                  <span className="ml-2 text-sm text-muted">{r.topics?.disciplines?.nome} · Revisão D{r.interval_days} · estudado em {fmtData(r.topics?.completed_date)}</span></span>
                <span className="text-sm">{r.atraso > 0 ? <span className="text-danger">{r.atraso} {r.atraso === 1 ? 'dia' : 'dias'} de atraso</span> : <span className="text-muted">{fmtData(r.due_date)}</span>}
                  {acerto.has(r.topic_id) && acerto.get(r.topic_id)! < 65 && <span className="ml-2 text-warn">acerto {acerto.get(r.topic_id)}%</span>}</span>
              </summary>
              <form action={concluirRevisao} className="mt-4 grid gap-3 sm:grid-cols-4">
                <input type="hidden" name="review_id" value={r.id} />
                <label className="space-y-1 text-sm">Acerto (%)<input name="desempenho" type="number" min={0} max={100} className={inputCls + ' w-full'} /></label>
                <label className="space-y-1 text-sm">Dificuldade<select name="dificuldade" defaultValue="" className={inputCls + ' w-full'}>
                  <option value="">—</option><option value={1}>Fácil</option><option value={2}>Médio</option><option value={3}>Difícil</option></select></label>
                <label className="space-y-1 text-sm">Questões feitas<input name="questoes_qtd" type="number" min={0} className={inputCls + ' w-full'} /></label>
                <label className="space-y-1 text-sm sm:col-span-4">Observações<textarea name="observacoes" rows={2} className={inputCls + ' w-full'} /></label>
                <button className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-black sm:col-span-4">Concluir revisão</button>
              </form>
            </details>))}
        </section>))}
    </div>
  )
}
