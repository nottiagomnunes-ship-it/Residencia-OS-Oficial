import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import { montarLista } from '@/lib/banco'
import { lerFiltros, SEM_ASSUNTO } from '@/lib/engine/banco'
import { AREAS, ROTULO_AREA } from '@/lib/engine/areas'
import { pct } from '@/lib/engine/desempenho'
import { fmtData, inputCls } from '@/components/ui'
import AvisoDaUrl from '@/components/AvisoDaUrl'
import { sincronizarBancoGeral, avisoDoBancoGeral } from '@/lib/banco-data'

/** Praticar: escolher o que estudar e começar (uma por vez ou lista como prova). Organizar as questões fica na aba Banco (/banco/questoes). */
export default async function PraticarInicio({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams, f = lerFiltros(sp)
  const sb = await supabaseServer()
  const aviso = avisoDoBancoGeral(await sincronizarBancoGeral(sb)) // questões novas e correções do banco geral, antes de contar
  const [{ data: todas, error }, { data: ds }, { data: listas }] = await Promise.all([
    sb.from('banco_questoes').select('discipline_id,assunto,banca,ano,vezes,acertos,gabarito,anulada').limit(20000),
    sb.from('disciplines').select('id,nome').order('ordem'),
    sb.from('provas').select('id,nome,criada_em,prova_tentativas(id,status,total,acertos)').eq('tipo', 'lista').order('criada_em', { ascending: false }).limit(8),
  ])
  if (error) return (
    <div className="space-y-4"><h1 className="text-2xl font-semibold">Praticar</h1>
      <p className="rounded-2xl border border-warn/40 bg-warn/10 p-4 text-sm text-warn">Para usar o banco de questões, rode <code>supabase/migrations/0034_banco_questoes.sql</code> no SQL Editor do Supabase (depois da 0028) e recarregue a página.</p></div>)
  const T = todas ?? [], nomeDisc = new Map((ds ?? []).map(d => [d.id as string, d.nome as string]))
  const feitas = T.filter(q => q.vezes > 0), acertosTot = T.reduce((s, q) => s + q.acertos, 0), vezesTot = T.reduce((s, q) => s + q.vezes, 0)
  const disponiveis = T.filter(q => q.gabarito && !q.anulada).length, semAssunto = T.filter(q => !q.assunto).length
  const discsComQuestao = [...new Set(T.map(q => q.discipline_id).filter(Boolean))] as string[]
  const assuntos = [...new Set(T.filter(q => !f.disciplina || q.discipline_id === f.disciplina).map(q => q.assunto).filter(Boolean))].sort() as string[]
  const bancas = [...new Set(T.map(q => q.banca).filter(Boolean))].sort() as string[]
  const anos = [...new Set(T.map(q => q.ano).filter((a): a is number => !!a))].sort((a, b) => b - a)
  const card = (l: string, v: string) => <div className="rounded-2xl border border-line bg-surface p-4"><p className="text-sm text-muted">{l}</p><p className="mt-1 text-2xl font-semibold">{v}</p></div>
  const sel = inputCls + ' w-full'
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">Praticar</h1><p className="text-sm text-muted">Escolha o que estudar e responda uma por vez, com a resposta na hora.</p></div>
        {T.length > 0 && <Link href="/banco/questoes" className="rounded-xl border border-line px-4 py-2 text-sm hover:border-brand">Ver e organizar o banco</Link>}
      </div>
      {sp.erro && <AvisoDaUrl tipo="erro" chaves={['erro']}>{sp.erro}</AvisoDaUrl>}
      {aviso && <p role="status" className="rounded-xl border border-brand/40 bg-brand/10 p-3 text-sm">{aviso}</p>}

      {T.length === 0
        ? <div className="space-y-3 rounded-2xl border border-dashed border-line p-8 text-center">
          <p className="text-muted">Seu banco de questões está vazio. Importe um PDF ou .docx de questões (com o gabarito no fim) ou um pacote .json para começar a praticar.</p>
          <Link href="/banco/importar" className="inline-block rounded-xl bg-brand px-5 py-2.5 font-medium text-black">Importar questões</Link>
        </div>
        : <>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {card('Questões no banco', String(T.length))}{card('Já feitas', String(feitas.length))}
          {card('Acerto', vezesTot ? `${pct(acertosTot, vezesTot)}%` : '—')}{card('Com gabarito', String(disponiveis))}
        </div>

        <form className="grid gap-3 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-2 lg:grid-cols-7" action={montarLista}>
          <h2 className="font-medium sm:col-span-2 lg:col-span-7">O que você quer praticar?</h2>
          <label className="text-sm text-muted">Área<select name="area" defaultValue={f.area ?? ''} className={sel}><option value="">Todas</option>{AREAS.map(a => <option key={a} value={a}>{ROTULO_AREA[a]}</option>)}</select></label>
          <label className="text-sm text-muted">Disciplina<select name="disciplina" defaultValue={f.disciplina ?? ''} className={sel}><option value="">Todas</option>{discsComQuestao.map(d => <option key={d} value={d}>{nomeDisc.get(d) ?? 'Disciplina'}</option>)}</select></label>
          <label className="text-sm text-muted">Assunto<select name="assunto" defaultValue={f.assunto ?? ''} className={sel}><option value="">Todos</option>
            {semAssunto > 0 && <option value={SEM_ASSUNTO}>Sem assunto</option>}{assuntos.map(a => <option key={a} value={a}>{a}</option>)}</select></label>
          <label className="text-sm text-muted">Banca<select name="banca" defaultValue={f.banca ?? ''} className={sel}><option value="">Todas</option>{bancas.map(b => <option key={b} value={b}>{b}</option>)}</select></label>
          <fieldset className="text-sm text-muted"><legend>Ano da prova</legend><div className="flex items-center gap-1">
            <select name="de" defaultValue={f.anoDe ?? ''} aria-label="Ano: de" className={inputCls + ' min-w-0 flex-1'}><option value="">desde</option>{anos.map(a => <option key={a} value={a}>{a}</option>)}</select>–
            <select name="ate" defaultValue={f.anoAte ?? ''} aria-label="Ano: até" className={inputCls + ' min-w-0 flex-1'}><option value="">até</option>{anos.map(a => <option key={a} value={a}>{a}</option>)}</select></div></fieldset>
          <label className="text-sm text-muted">Situação<select name="situacao" defaultValue={f.situacao} className={sel}>
            <option value="todas">Todas</option><option value="nunca">Nunca fiz</option><option value="errei">Errei na última vez</option><option value="acertei">Acertei na última vez</option></select></label>
          <label className="text-sm text-muted">Quantas (lista)<select name="quantidade" defaultValue="10" className={sel}>{[5, 10, 20, 30, 50].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
          <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-7">
            <button formAction="/banco/praticar" formMethod="get" className="rounded-xl bg-brand px-5 py-2.5 font-medium text-black">Praticar</button>
            <button className="rounded-xl border border-line px-4 py-2.5 text-sm hover:border-brand">Montar lista (como prova)</button>
            <button formAction="/banco/questoes" formMethod="get" className="rounded-xl border border-line px-4 py-2.5 text-sm hover:border-brand">Ver estas questões no Banco</button>
          </div>
          <p className="text-xs text-muted sm:col-span-2 lg:col-span-7"><b>Praticar</b>: uma questão por vez, com a resposta na hora; pode parar quando quiser. <b>Montar lista</b>: sorteia a quantidade escolhida e corrige só no fim, como uma prova. Nos dois, os erros vão para o Caderno de Erros e o resultado para o Desempenho. Só entram questões com gabarito.</p>
          {f.topico && <input type="hidden" name="topico" value={f.topico} />}
        </form>

        {semAssunto > 0 && <p className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm">
          <span className="text-muted">{semAssunto} {semAssunto === 1 ? 'questão está' : 'questões estão'} sem assunto e não {semAssunto === 1 ? 'entra' : 'entram'} no Desempenho por assunto.</span>
          <Link href={`/banco/questoes?assunto=${encodeURIComponent(SEM_ASSUNTO)}`} className="text-brand hover:underline">Organizar no Banco →</Link></p>}

        {(listas ?? []).length > 0 && <section className="space-y-2">
          <h2 className="font-medium">Listas recentes</h2>
          <ul className="grid gap-2 md:grid-cols-2">{(listas ?? []).map((l: any) => { const t = (l.prova_tentativas ?? [])[0]; return (
            <li key={l.id}><Link href={t ? `/provas/tentativa/${t.id}` : `/provas/${l.id}`} className="flex flex-wrap justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm hover:border-brand">
              <span>{l.nome}</span><span className="text-muted">{t?.status === 'corrigida' ? `${t.acertos}/${t.total} (${pct(t.acertos ?? 0, t.total ?? 0)}%)` : t ? 'em andamento' : ''} · {fmtData(String(l.criada_em).slice(0, 10))}</span></Link></li>) })}</ul>
        </section>}
      </>}
    </div>)
}
