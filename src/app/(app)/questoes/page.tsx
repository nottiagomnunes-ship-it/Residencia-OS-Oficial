import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import { registrarQuestoes, excluirQuestoes } from '@/lib/questoes'
import { hojeBR } from '@/lib/dates'
import { aproveitamento } from '@/lib/engine/questoes'
import { fmtData, inputCls } from '@/components/ui'
import { AlvoSelect } from '@/components/AlvoSelect'

const corAcerto = (p: number | null) => (p == null ? '' : p >= 75 ? 'text-brand' : p >= 60 ? 'text-warn' : 'text-danger')

export default async function Questoes({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string; alvo?: string; total?: string }> }) {
  const { ok, erro, alvo, total: totalSugerido } = await searchParams, hoje = hojeBR()
  const sb = await supabaseServer()
  const [{ data: ds }, { data: ts }, { data: todas }, { data: hist }] = await Promise.all([
    sb.from('disciplines').select('id,nome').order('ordem'), sb.from('topics').select('id,nome,discipline_id').order('nome'),
    sb.from('question_sets').select('total,acertos').limit(10000),
    sb.from('question_sets').select('id,total,acertos,erros,banca,prova,ano,tempo_min,realizado_em,disciplines(nome),topics(nome)').order('realizado_em', { ascending: false }).limit(50),
  ])
  const total = (todas ?? []).reduce((s, x) => s + x.total, 0), acertos = (todas ?? []).reduce((s, x) => s + x.acertos, 0)
  const [t, a] = (ok ?? '').split('-').map(Number)
  const card = (l: string, v: string, c = '') => <div className="rounded-2xl border border-line bg-surface p-4"><p className="text-sm text-muted">{l}</p><p className={`mt-1 text-2xl font-semibold ${c}`}>{v}</p></div>
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Questões</h1>
      {ok && t > 0 && <p role="status" className="rounded-xl border border-brand/40 bg-brand/10 p-4 text-sm">Registrado: {t} questões, {aproveitamento(a, t)}% de aproveitamento.{t - a > 0 && <> Você errou {t - a}: <Link href="/caderno-de-erros" className="text-brand underline">adicione ao Caderno de Erros</Link>.</>}</p>}
      {erro && <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger">{erro}</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {card('Questões realizadas', String(total))}{card('Aproveitamento', total ? `${aproveitamento(acertos, total)}%` : '—', corAcerto(aproveitamento(acertos, total)))}
        {card('Acertos', String(acertos))}{card('Erros', String(total - acertos))}
      </div>
      <form action={registrarQuestoes} className="grid gap-3 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-2 xl:grid-cols-4">
        <h2 className="font-medium sm:col-span-2 xl:col-span-4">Registrar questões</h2>
        <AlvoSelect ds={ds ?? []} ts={ts ?? []} defaultValue={alvo} />
        <input name="banca" placeholder="Banca" className={inputCls} /><input name="prova" placeholder="Prova" className={inputCls} />
        <input name="ano" type="number" min={1990} max={2100} placeholder="Ano" className={inputCls} />
        <input name="total" type="number" min={1} required defaultValue={totalSugerido} placeholder="Questões feitas" className={inputCls} />
        <input name="acertos" type="number" min={0} required placeholder="Acertos" className={inputCls} />
        <input name="tempo_min" type="number" min={0} placeholder="Tempo (min)" className={inputCls} />
        <select name="dificuldade" defaultValue="" aria-label="Dificuldade" className={inputCls}><option value="">Dificuldade</option><option value={1}>Fácil</option><option value={2}>Médio</option><option value={3}>Difícil</option></select>
        <input name="data" type="date" defaultValue={hoje} aria-label="Data" className={inputCls} />
        <button className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-black sm:col-span-2 xl:col-span-4">Registrar</button>
      </form>
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="text-muted"><tr className="border-b border-line">{['Data', 'Assunto', 'Prova', 'Questões', 'Acertos', 'Aproveitamento', 'Tempo', ''].map(h => <th key={h} className="px-4 py-3 font-normal">{h}</th>)}</tr></thead>
          <tbody>{((hist ?? []) as any[]).map(q => { const p = aproveitamento(q.acertos, q.total); return (
            <tr key={q.id} className="border-b border-line/60 last:border-0">
              <td className="px-4 py-3">{fmtData(q.realizado_em)}</td>
              <td className="px-4 py-3">{q.topics?.nome ?? q.disciplines?.nome}<span className="block text-xs text-muted">{q.topics ? q.disciplines?.nome : 'geral'}</span></td>
              <td className="px-4 py-3 text-muted">{[q.banca, q.prova, q.ano].filter(Boolean).join(' · ') || '—'}</td>
              <td className="px-4 py-3">{q.total}</td><td className="px-4 py-3">{q.acertos}</td>
              <td className={`px-4 py-3 font-medium ${corAcerto(p)}`}>{p}%</td><td className="px-4 py-3">{q.tempo_min ? `${q.tempo_min} min` : '—'}</td>
              <td className="px-4 py-3"><form action={excluirQuestoes}><input type="hidden" name="id" value={q.id} /><button className="text-danger hover:underline">Excluir</button></form></td></tr>) })}</tbody>
        </table>
        {!hist?.length && <p className="p-6 text-center text-muted">Nenhuma questão registrada. Use o formulário acima depois da sua próxima sessão de questões.</p>}
      </div>
    </div>
  )
}
