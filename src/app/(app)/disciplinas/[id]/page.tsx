import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { Badge, Bar, STATUS, fmtData } from '@/components/ui'

import { carregarAreas } from '@/lib/areas-data'
import AreaDaDisciplina from '@/components/AreaDaDisciplina'
import { contarNoBanco } from '@/lib/banco-data'
export default async function Disciplina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = await supabaseServer()
  const { data: d } = await sb.from('disciplines').select('id,nome,cor').eq('id', id).maybeSingle()
  const areas = await carregarAreas(sb)
  if (!d) notFound()
  const [{ data: ts }, { data: qs }, { data: rs }, noBanco] = await Promise.all([
    sb.from('topics').select('id,nome,subcategoria,status').eq('discipline_id', id).order('subcategoria').order('nome'),
    sb.from('question_sets').select('topic_id,total,acertos').eq('discipline_id', id),
    sb.from('reviews').select('topic_id,due_date,topics!inner(discipline_id)').eq('status', 'pendente').eq('topics.discipline_id', id),
    contarNoBanco(sb, { ...{ area: null, disciplina: null, assunto: null, topico: null, banca: null, situacao: 'todas' as const, busca: '', anoDe: null, anoAte: null }, disciplina: id }),
  ])
  const topics = ts ?? [], sets = qs ?? [], revs = rs ?? []
  const ok = topics.filter(t => t.status === 'concluido').length
  const pct = topics.length ? Math.round((ok / topics.length) * 100) : 0
  const tot = sets.reduce((a, s) => a + s.total, 0), ac = sets.reduce((a, s) => a + s.acertos, 0)
  const stat = (l: string, v: string) => <div className="rounded-2xl border border-line bg-surface p-4"><p className="text-sm text-muted">{l}</p><p className="mt-1 text-2xl font-semibold">{v}</p></div>
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold" style={{ color: d.cor }}>{d.nome}</h1><div className="flex flex-wrap items-center gap-2">{noBanco > 0 && <Link href={`/banco/praticar?disciplina=${d.id}`} className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-black">Praticar questões ({noBanco})</Link>}{areas.disponivel && <AreaDaDisciplina id={d.id} area={areas.mapa[d.id] ?? null} />}</div></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-line bg-surface p-4"><p className="text-sm text-muted">Progresso</p><p className="mb-2 mt-1 text-2xl font-semibold">{pct}%</p><Bar pct={pct} cor={d.cor} /></div>
        {stat('Conteúdos', `${ok}/${topics.length}`)}{stat('Questões', String(tot))}
        {stat('Aproveitamento', tot ? `${Math.round((ac / tot) * 100)}%` : '—')}{stat('Revisões pendentes', String(revs.length))}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full text-left text-sm max-md:block">
          <thead className="text-muted max-md:hidden"><tr className="border-b border-line">{['Assunto', 'Status', 'Progresso', 'Questões', 'Acerto', 'Próxima revisão'].map(h => <th key={h} className="px-4 py-3 font-normal">{h}</th>)}</tr></thead>
          <tbody className="max-md:block">{topics.map(t => {
            const s = sets.filter(x => x.topic_id === t.id), q = s.reduce((a, x) => a + x.total, 0), a = s.reduce((n, x) => n + x.acertos, 0)
            const next = revs.filter(r => r.topic_id === t.id).map(r => r.due_date).sort()[0]
            return (<tr key={t.id} className="max-md:block max-md:py-3 border-b border-line/60 last:border-0">
              <td className="px-4 py-3 max-md:block max-md:px-0 max-md:py-0.5 max-md:before:mr-1 max-md:before:text-muted max-md:before:content-[attr(data-label)]"><Link href={`/conteudos/${t.id}`} className="hover:text-brand hover:underline">{t.nome}</Link><span className="block text-xs text-muted">{t.subcategoria}</span></td>
              <td data-label="Status:" className="px-4 py-3 max-md:block max-md:px-0 max-md:py-0.5 max-md:before:mr-1 max-md:before:text-muted max-md:before:content-[attr(data-label)]"><Badge status={t.status} /></td><td data-label="Progresso:" className="px-4 py-3 max-md:block max-md:px-0 max-md:py-0.5 max-md:before:mr-1 max-md:before:text-muted max-md:before:content-[attr(data-label)]">{STATUS[t.status].pct}%</td>
              <td data-label="Questões:" className="px-4 py-3 max-md:block max-md:px-0 max-md:py-0.5 max-md:before:mr-1 max-md:before:text-muted max-md:before:content-[attr(data-label)]">{q}</td><td data-label="Acerto:" className="px-4 py-3 max-md:block max-md:px-0 max-md:py-0.5 max-md:before:mr-1 max-md:before:text-muted max-md:before:content-[attr(data-label)]">{q ? `${Math.round((a / q) * 100)}%` : '—'}</td><td data-label="Próxima revisão:" className="px-4 py-3 max-md:block max-md:px-0 max-md:py-0.5 max-md:before:mr-1 max-md:before:text-muted max-md:before:content-[attr(data-label)]">{fmtData(next)}</td></tr>)
          })}</tbody>
        </table>
        {!topics.length && <p className="p-6 text-center text-muted">Nenhum assunto ainda. Importe o catálogo em Matérias → Assuntos.</p>}
      </div>
    </div>
  )
}
