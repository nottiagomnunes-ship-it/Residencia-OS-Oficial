import { supabaseServer } from '@/lib/supabase/server'
import { addDiscipline } from '@/lib/actions'
import { inputCls } from '@/components/ui'
import { carregarAreas, comArea } from '@/lib/areas-data'
import { agruparPorArea, sugerirArea } from '@/lib/engine/areas'
import { DisciplinasPorArea, DisciplinasSimples, type CartaoDisciplina } from '@/components/DisciplinasPorArea'
import OrganizarAreas from '@/components/OrganizarAreas'

export default async function Disciplinas() {
  const sb = await supabaseServer()
  const [{ data: ds }, { data: ts }, areas] = await Promise.all([
    sb.from('disciplines').select('id,nome,cor,peso').order('ordem'), sb.from('topics').select('discipline_id,status'), carregarAreas(sb),
  ])
  const cartoes: CartaoDisciplina[] = comArea(ds ?? [], areas.mapa).map(d => {
    const t = (ts ?? []).filter(x => x.discipline_id === d.id)
    return { id: d.id, nome: d.nome, cor: d.cor, peso: d.peso, ok: t.filter(x => x.status === 'concluido').length, total: t.length, area: d.area }
  })
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Disciplinas</h1>
      {areas.disponivel
        ? <>
            <OrganizarAreas disciplinas={cartoes.map(c => ({ id: c.id, nome: c.nome, area: c.area, sugerida: sugerirArea(c.nome) }))} />
            <DisciplinasPorArea grupos={agruparPorArea(cartoes)} />
          </>
        : <>
            <DisciplinasSimples itens={cartoes} />
            <p className="text-sm text-muted">Para organizar as disciplinas nas 5 áreas da prova, aplique a atualização do banco de dados (SQL <code>0027_areas_das_disciplinas</code>) no Supabase.</p>
          </>}
      <form action={addDiscipline} className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-5">
        <label className="space-y-1"><span className="block text-sm">Nova disciplina</span><input name="nome" required className={inputCls} placeholder="Ex.: Ortopedia" /></label>
        <label className="space-y-1"><span className="block text-sm">Peso</span>
          <select name="peso" defaultValue={3} className={inputCls}>{[1, 2, 3, 4, 5].map(n => <option key={n}>{n}</option>)}</select></label>
        <button className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-on-cor">Adicionar disciplina</button>
        <p className="w-full text-xs text-muted">A área da prova é sugerida pelo nome (por exemplo, Ortopedia fica em Cirurgia). Você pode mudar depois.</p>
      </form>
    </div>
  )
}
