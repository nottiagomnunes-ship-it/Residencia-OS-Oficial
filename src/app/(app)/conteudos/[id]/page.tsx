import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { Badge, NIVEL, PRIORIDADE, fmtData } from '@/components/ui'
import { pct } from '@/lib/engine/desempenho'
import type { Etapa } from '@/lib/engine/etapas'
import { carregarModelos } from '@/lib/etapas-data'
import Checklist from '@/components/Checklist'
import { contarNoBanco } from '@/lib/banco-data'

export default async function Assunto({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = await supabaseServer()
  const { data: t } = await sb.from('topics').select('id,nome,discipline_id,subcategoria,status,prioridade,dificuldade,planned_date,completed_date,disciplines(nome)').eq('id', id).maybeSingle()
  if (!t) notFound()
  const [{ data: et }, { data: qs }, { data: rv }, modelos, noBanco] = await Promise.all([
    sb.from('topic_tasks').select('id,tipo,titulo,qtd_questoes,concluida').eq('topic_id', id).order('ordem').order('created_at'),
    sb.from('question_sets').select('total,acertos').eq('topic_id', id),
    sb.from('reviews').select('due_date').eq('topic_id', id).eq('status', 'pendente').order('due_date').limit(1),
    carregarModelos(sb),
    contarNoBanco(sb, { area: null, disciplina: null, assunto: null, topico: id, banca: null, situacao: 'todas' as const, busca: '' }, { id: t.id, nome: t.nome, discipline_id: (t as any).discipline_id }),
  ])
  const total = (qs ?? []).reduce((n, x) => n + x.total, 0), ac = (qs ?? []).reduce((n, x) => n + x.acertos, 0)
  const disc = (t as any).disciplines?.nome as string | undefined
  const info = (l: string, v: string) => <div className="rounded-2xl border border-line bg-surface p-4"><p className="text-sm text-muted">{l}</p><p className="mt-1 font-semibold">{v}</p></div>
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/conteudos" className="text-sm text-muted hover:text-brand">← Conteúdos</Link>
        <h1 className="mt-1 text-2xl font-semibold">{t.nome}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">{disc}{t.subcategoria ? ` › ${t.subcategoria}` : ''} <Badge status={t.status} /></p>
        {noBanco > 0 && <Link href={`/banco/praticar?topico=${t.id}`} className="mt-3 inline-block rounded-xl bg-brand px-4 py-2 text-sm font-medium text-black">Praticar questões deste assunto ({noBanco})</Link>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {info('Prioridade · dificuldade', `${PRIORIDADE[t.prioridade]} · ${NIVEL[t.dificuldade]}`)}
        {info(t.completed_date ? 'Concluído em' : 'Planejado para', fmtData(t.completed_date ?? t.planned_date))}
        {info('Questões', total ? `${total} · ${pct(ac, total)}% de acerto` : 'nenhuma ainda')}
        {info('Próxima revisão', fmtData(rv?.[0]?.due_date))}
      </div>
      <Checklist topicId={t.id} inicial={(et ?? []) as Etapa[]} modelos={modelos} concluido={t.status === 'concluido'} />
    </div>
  )
}
