import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import { addTopic, updateTopic, deleteTopic, importCatalog } from '@/lib/actions'
import { carregarModelos, carregarUltimoLote } from '@/lib/etapas-data'
import EtapasEmLote from '@/components/EtapasEmLote'
import { concluirConteudo } from '@/lib/flow'
import { Badge, PRIORIDADE, NIVEL, inputCls } from '@/components/ui'

import { carregarAreas, comArea } from '@/lib/areas-data'
import { AREAS, ROTULO_AREA, agruparPorArea, ehArea } from '@/lib/engine/areas'

export default async function Conteudos({ searchParams }: { searchParams: Promise<{ d?: string; area?: string }> }) {
  const { d, area: areaParam } = await searchParams
  const sb = await supabaseServer()
  const areas = await carregarAreas(sb)
  const filtroArea = areas.disponivel && (areaParam === 'sem_area' || ehArea(areaParam)) ? areaParam : null
  let q = sb.from('topics').select('id,nome,subcategoria,status,prioridade,dificuldade,planned_date,discipline_id,grupo,ordem,disciplines(nome)').order('ordem', { nullsFirst: false }).order('nome')
  if (d) q = q.eq('discipline_id', d)
  else if (filtroArea) {
    const ids = Object.entries(areas.mapa).filter(([, a]) => (filtroArea === 'sem_area' ? !a : a === filtroArea)).map(([id]) => id)
    q = q.in('discipline_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']) // área sem disciplinas: lista vazia
  }
  const [{ data: ts }, { data: ds }, { data: et }, { data: todos }, modelos, ultimo] = await Promise.all([q, sb.from('disciplines').select('id,nome').order('ordem'), sb.from('topic_tasks').select('topic_id,concluida'), sb.from('topics').select('id,status,grupo,discipline_id'), carregarModelos(sb), carregarUltimoLote(sb)])
  const etapas = new Map<string, [number, number]>()
  ;(et ?? []).forEach(x => { const a = etapas.get(x.topic_id) ?? [0, 0]; etapas.set(x.topic_id, [a[0] + (x.concluida ? 1 : 0), a[1] + 1]) })
  const dsA = comArea(ds ?? [], areas.mapa), areaDaDisc = d ? dsA.find(x => x.id === d)?.area ?? null : null
  const temAreas = areas.disponivel && dsA.some(x => x.area)
  const chipsDisc = filtroArea ? dsA.filter(x => (filtroArea === 'sem_area' ? !x.area : x.area === filtroArea)) : dsA
  const chip = (on: boolean) => `rounded-full border px-3 py-1 text-sm ${on ? 'border-brand text-brand' : 'border-line text-muted'}`
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Assuntos</h1>
        <Link href="/importar" className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-black">Importar meu cronograma</Link>
        <form action={importCatalog}><button className="rounded-xl border border-line px-4 py-2 text-sm hover:border-brand">Importar catálogo de assuntos</button></form>
      </div>
      {temAreas && (
        <div role="group" aria-label="Filtrar por área" className="flex flex-wrap gap-2">
          <Link href="/conteudos" className={chip(!d && !filtroArea)}>Todas as áreas</Link>
          {AREAS.filter(a => dsA.some(x => x.area === a)).map(a => <Link key={a} href={`/conteudos?area=${a}`} className={chip(filtroArea === a || areaDaDisc === a)}>{ROTULO_AREA[a]}</Link>)}
          {dsA.some(x => !x.area) && <Link href="/conteudos?area=sem_area" className={chip(filtroArea === 'sem_area')}>Sem área</Link>}
        </div>)}
      <div role="group" aria-label="Filtrar por disciplina" className="flex flex-wrap gap-2">
        <Link href={filtroArea ? `/conteudos?area=${filtroArea}` : '/conteudos'} className={chip(!d)}>{filtroArea ? 'Todas desta área' : 'Todas'}</Link>
        {chipsDisc.map(x => <Link key={x.id} href={`/conteudos?d=${x.id}`} className={chip(d === x.id)}>{x.nome}</Link>)}
      </div>
      <EtapasEmLote topicos={todos ?? []} etapasPorTopico={Object.fromEntries([...etapas].map(([k, v]) => [k, v[1]]))} disciplinas={ds ?? []} modelos={modelos} ultimo={ultimo} />
      <form action={addTopic} className="grid gap-3 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-2 xl:grid-cols-6">
        <select name="discipline_id" required defaultValue={d ?? ''} className={inputCls}><option value="" disabled>Disciplina</option>{temAreas ? agruparPorArea(dsA).map(g => <optgroup key={g.rotulo} label={g.rotulo}>{g.itens.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}</optgroup>) : (ds ?? []).map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}</select>
        <input name="subcategoria" placeholder="Subcategoria" className={inputCls} />
        <input name="nome" required placeholder="Nome do assunto" className={inputCls} />
        <select name="prioridade" defaultValue={2} className={inputCls}>{[1, 2, 3].map(n => <option key={n} value={n}>Prioridade {PRIORIDADE[n].toLowerCase()}</option>)}</select>
        <select name="dificuldade" defaultValue={2} className={inputCls}>{[1, 2, 3].map(n => <option key={n} value={n}>{NIVEL[n]}</option>)}</select>
        <input name="planned_date" type="date" aria-label="Data planejada" className={inputCls} />
        <button className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-black sm:col-span-2 xl:col-span-6">Adicionar conteúdo</button>
      </form>
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full text-left text-sm max-md:block">
          <thead className="text-muted max-md:hidden"><tr className="border-b border-line">{['Assunto', 'Disciplina', 'Dificuldade', 'Status', 'Prioridade', ''].map(h => <th key={h} className="px-4 py-3 font-normal">{h}</th>)}</tr></thead>
          <tbody className="max-md:block">{(ts ?? []).map((t: any) => (
            <tr key={t.id} className="max-md:block max-md:py-3 border-b border-line/60 last:border-0">
              <td className="px-4 py-3 max-md:block max-md:px-0 max-md:py-0.5 max-md:before:mr-1 max-md:before:text-muted max-md:before:content-[attr(data-label)]"><Link href={`/conteudos/${t.id}`} className="hover:text-brand hover:underline">{t.nome}</Link>{etapas.has(t.id) && <span className="ml-2 rounded-full bg-line px-2 py-0.5 text-xs text-muted">{etapas.get(t.id)![0]}/{etapas.get(t.id)![1]} etapas</span>}<span className="block text-xs text-muted">{[t.grupo, t.subcategoria].filter(Boolean).join(' · ')}</span></td>
              <td data-label="Disciplina:" className="px-4 py-3 max-md:block max-md:px-0 max-md:py-0.5 max-md:before:mr-1 max-md:before:text-muted max-md:before:content-[attr(data-label)]">{t.disciplines?.nome}</td><td data-label="Dificuldade:" className="px-4 py-3 max-md:block max-md:px-0 max-md:py-0.5 max-md:before:mr-1 max-md:before:text-muted max-md:before:content-[attr(data-label)]">{NIVEL[t.dificuldade]}</td>
              <td colSpan={3} className="px-4 py-2 max-md:block max-md:px-0 max-md:py-0.5 max-md:before:mr-1 max-md:before:text-muted max-md:before:content-[attr(data-label)]">
                <div className="flex flex-wrap items-center gap-2">
                  <form action={updateTopic} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={t.id} />
                    {t.status === 'concluido' ? <><Badge status="concluido" /><input type="hidden" name="status" value="concluido" /></> :
                      <select name="status" defaultValue={t.status} className={inputCls} aria-label="Status">
                        {['nao_iniciado', 'planejado', 'em_andamento'].map(s => <option key={s} value={s}>{s === 'nao_iniciado' ? 'Não iniciado' : s === 'planejado' ? 'Planejado' : 'Em andamento'}</option>)}</select>}
                    <select name="prioridade" defaultValue={t.prioridade} className={inputCls} aria-label="Prioridade">{[1, 2, 3].map(n => <option key={n} value={n}>{PRIORIDADE[n]}</option>)}</select>
                    <button className="rounded-lg border border-line px-3 py-1.5 hover:border-brand">Salvar</button>
                  </form>
                  {t.status !== 'concluido' && <details><summary className="cursor-pointer rounded-lg bg-brand px-3 py-1.5 font-medium text-black">Concluir</summary>
                    <form action={concluirConteudo} className="mt-2 flex items-center gap-2"><input type="hidden" name="topic_id" value={t.id} />
                      <input name="duration_min" type="number" inputMode="numeric" min={0} defaultValue={60} aria-label="Minutos estudados" className={inputCls + ' w-24'} /><span className="text-muted">min</span>
                      <button className="rounded-lg border border-line px-3 py-1.5 hover:border-brand">Confirmar</button></form></details>}
                  <form action={deleteTopic}><input type="hidden" name="id" value={t.id} /><button className="rounded-lg px-3 py-1.5 text-danger hover:bg-danger/10">Excluir</button></form>
                </div></td></tr>))}</tbody>
        </table>
        {!ts?.length && <p className="p-6 text-center text-muted">Nenhum conteúdo por aqui. Importe o seu cronograma, o catálogo sugerido ou adicione o primeiro assunto.</p>}
      </div>
    </div>
  )
}
