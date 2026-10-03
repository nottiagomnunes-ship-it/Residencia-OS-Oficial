import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import { registrarQuestoes, excluirQuestoes } from '@/lib/questoes'
import { hojeBR } from '@/lib/dates'
import { aproveitamento } from '@/lib/engine/questoes'
import { fmtData, inputCls } from '@/components/ui'
import QuestoesForm from '@/components/QuestoesForm'
import AvisoDaUrl from '@/components/AvisoDaUrl'

const corAcerto = (p: number | null) => (p == null ? '' : p >= 75 ? 'text-brand' : p >= 60 ? 'text-warn' : 'text-danger')

export default async function Questoes({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string; alvo?: string; total?: string; xp?: string; etapas?: string; tempo?: string }> }) {
  const { ok, erro, alvo, total: totalSugerido, xp, etapas, tempo } = await searchParams, hoje = hojeBR()
  const sb = await supabaseServer()
  const [{ data: ds }, { data: ts }, { data: todas }, { data: hist }] = await Promise.all([
    sb.from('disciplines').select('id,nome').order('ordem'), sb.from('topics').select('id,nome,discipline_id').order('nome'),
    sb.from('question_sets').select('total,acertos').limit(10000),
    sb.from('question_sets').select('id,total,acertos,erros,banca,prova,ano,tempo_min,realizado_em,mock_exam_id,disciplines(nome),topics(nome)').order('realizado_em', { ascending: false }).limit(50),
  ])
  const total = (todas ?? []).reduce((s, x) => s + x.total, 0), acertos = (todas ?? []).reduce((s, x) => s + x.acertos, 0)
  const [t, a] = (ok ?? '').split('-').map(Number)
  const card = (l: string, v: string, c = '') => <div className="rounded-2xl border border-line bg-surface p-4"><p className="text-sm text-muted">{l}</p><p className={`mt-1 text-2xl font-semibold ${c}`}>{v}</p></div>
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Questões</h1>
      {ok && t > 0 && <AvisoDaUrl tipo="ok" chaves={['ok', 'xp', 'etapas']}>Registrado: {t} questões, {aproveitamento(a, t)}% de aproveitamento.{xp && <b className="text-brand"> +{xp} XP.</b>}{etapas && +etapas > 0 && <> Marquei {etapas} {+etapas === 1 ? 'etapa' : 'etapas'} automaticamente.</>}{t - a > 0 && <> Você errou {t - a}: <Link href="/caderno-de-erros" className="text-brand underline">adicione ao Caderno de Erros</Link>.</>}</AvisoDaUrl>}
      {erro && <AvisoDaUrl tipo="erro" chaves={['erro']}>{erro}</AvisoDaUrl>}
      <div className="space-y-6 lg:grid lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start lg:gap-6 lg:space-y-0">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4 lg:col-start-2 lg:row-start-1 lg:grid-cols-2 xl:grid-cols-4">
        {card('Questões realizadas', String(total))}{card('Aproveitamento', total ? `${aproveitamento(acertos, total)}%` : '—', corAcerto(aproveitamento(acertos, total)))}
        {card('Acertos', String(acertos))}{card('Erros', String(total - acertos))}
      </div>
      <QuestoesForm ds={ds ?? []} ts={ts ?? []} alvo={alvo} totalInicial={totalSugerido} tempoInicial={tempo} hoje={hoje} className="lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-6 lg:self-start" />
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface lg:hidden">
        <table className="w-full text-left text-sm max-md:block">
          <thead className="text-muted max-md:hidden"><tr className="border-b border-line">{['Data', 'Assunto', 'Prova', 'Questões', 'Acertos', 'Aproveitamento', 'Tempo', ''].map(h => <th key={h} className="px-4 py-3 font-normal">{h}</th>)}</tr></thead>
          <tbody className="max-md:block">{((hist ?? []) as any[]).map(q => { const p = aproveitamento(q.acertos, q.total); return (
            <tr key={q.id} className="max-md:block max-md:py-3 border-b border-line/60 last:border-0">
              <td className="px-4 py-3 max-md:block max-md:px-0 max-md:py-0.5 max-md:before:mr-1 max-md:before:text-muted max-md:before:content-[attr(data-label)]">{fmtData(q.realizado_em)}</td>
              <td className="px-4 py-3 max-md:block max-md:px-0 max-md:py-0.5 max-md:before:mr-1 max-md:before:text-muted max-md:before:content-[attr(data-label)]">{q.topics?.nome ?? q.disciplines?.nome}<span className="block text-xs text-muted">{q.topics ? q.disciplines?.nome : 'geral'}</span></td>
              <td data-label="Prova:" className="px-4 py-3 max-md:block max-md:px-0 max-md:py-0.5 max-md:before:mr-1 max-md:before:text-muted max-md:before:content-[attr(data-label)] text-muted">{[q.banca, q.prova, q.ano].filter(Boolean).join(' · ') || '—'}</td>
              <td data-label="Questões:" className="px-4 py-3 max-md:block max-md:px-0 max-md:py-0.5 max-md:before:mr-1 max-md:before:text-muted max-md:before:content-[attr(data-label)]">{q.total}</td><td data-label="Acertos:" className="px-4 py-3 max-md:block max-md:px-0 max-md:py-0.5 max-md:before:mr-1 max-md:before:text-muted max-md:before:content-[attr(data-label)]">{q.acertos}</td>
              <td data-label="Aproveitamento:" className={`px-4 py-3 max-md:block max-md:px-0 max-md:py-0.5 max-md:before:mr-1 max-md:before:text-muted max-md:before:content-[attr(data-label)] font-medium ${corAcerto(p)}`}>{p}%</td><td data-label="Tempo:" className="px-4 py-3 max-md:block max-md:px-0 max-md:py-0.5 max-md:before:mr-1 max-md:before:text-muted max-md:before:content-[attr(data-label)]">{q.tempo_min ? `${q.tempo_min} min` : '—'}</td>
              <td className="px-4 py-3 max-md:block max-md:px-0 max-md:py-0.5 max-md:before:mr-1 max-md:before:text-muted max-md:before:content-[attr(data-label)]">{q.mock_exam_id ? <span className="text-xs text-muted">Faz parte de um simulado</span> : <form action={excluirQuestoes}><input type="hidden" name="id" value={q.id} /><button className="text-danger hover:underline">Excluir</button></form>}</td></tr>) })}</tbody>
        </table>
        {!hist?.length && <p className="p-6 text-center text-muted">Nenhuma questão registrada. Use o formulário acima depois da sua próxima sessão de questões.</p>}
      </div>
      <div className="hidden space-y-3 lg:col-start-2 lg:row-start-2 lg:block">
        {((hist ?? []) as any[]).map(q => { const p = aproveitamento(q.acertos, q.total); const prova = [q.banca, q.prova, q.ano].filter(Boolean).join(' · '); return (
          <article key={q.id} className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-baseline justify-between gap-3"><span className="font-medium">{q.topics?.nome ?? q.disciplines?.nome ?? 'Sem assunto'}</span><span className={`font-semibold ${corAcerto(p)}`}>{p}%</span></div>
            <p className="mt-1 text-sm text-muted">{fmtData(q.realizado_em)} · {q.acertos}/{q.total} acertos{q.tempo_min ? ` · ${q.tempo_min} min` : ''}{prova ? ` · ${prova}` : ''}</p>
            {q.mock_exam_id ? <span className="text-xs text-muted">Faz parte de um simulado</span> : <form action={excluirQuestoes} className="mt-2"><input type="hidden" name="id" value={q.id} /><button className="text-sm text-danger hover:underline">Excluir</button></form>}
          </article>) })}
        {!hist?.length && <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">Nenhuma questão registrada. Use o formulário ao lado depois da sua próxima sessão de questões.</p>}
      </div>
      </div>
    </div>
  )
}
