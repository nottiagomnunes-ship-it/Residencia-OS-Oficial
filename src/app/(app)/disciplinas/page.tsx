import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import { addDiscipline } from '@/lib/actions'
import { Bar, inputCls } from '@/components/ui'

export default async function Disciplinas() {
  const sb = await supabaseServer()
  const [{ data: ds }, { data: ts }] = await Promise.all([
    sb.from('disciplines').select('id,nome,cor,peso').order('ordem'), sb.from('topics').select('discipline_id,status'),
  ])
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Disciplinas</h1>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(ds ?? []).map(d => {
          const t = (ts ?? []).filter(x => x.discipline_id === d.id), ok = t.filter(x => x.status === 'concluido').length
          const pct = t.length ? Math.round((ok / t.length) * 100) : 0
          return (
            <Link key={d.id} href={`/disciplinas/${d.id}`} className="space-y-3 rounded-2xl border border-line bg-surface p-5 hover:border-brand/50">
              <div className="flex items-center justify-between"><h2 className="font-medium">{d.nome}</h2><span className="text-xs text-muted">peso {d.peso}</span></div>
              <Bar pct={pct} cor={d.cor} />
              <p className="text-sm text-muted">{ok}/{t.length} conteúdos concluídos · {pct}%</p>
            </Link>)
        })}
      </div>
      <form action={addDiscipline} className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-5">
        <label className="space-y-1"><span className="block text-sm">Nova disciplina</span><input name="nome" required className={inputCls} placeholder="Ex.: Ortopedia" /></label>
        <label className="space-y-1"><span className="block text-sm">Peso</span>
          <select name="peso" defaultValue={3} className={inputCls}>{[1, 2, 3, 4, 5].map(n => <option key={n}>{n}</option>)}</select></label>
        <button className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-black">Adicionar disciplina</button>
      </form>
    </div>
  )
}
