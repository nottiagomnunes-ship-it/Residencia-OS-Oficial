import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import { montarLista } from '@/lib/banco'
import { lerFiltros } from '@/lib/engine/banco'
import { pct } from '@/lib/engine/desempenho'
import { fmtData, inputCls } from '@/components/ui'
import AvisoDaUrl from '@/components/AvisoDaUrl'
import { sincronizarBancoGeral, avisoDoBancoGeral, carregarTemas, ehAdmin, carregarFilaRefazer } from '@/lib/banco-data'
import { hojeBR } from '@/lib/dates'
import { addDays } from '@/lib/engine/review'
import OpcoesDeAssunto from '@/components/banco/OpcoesDeAssunto'
import { todasAsLinhas } from '@/lib/paginar'

/** Praticar: escolher o que estudar e começar (uma por vez ou lista como prova). Editar e publicar as questões fica na Administração (/admin). */
export default async function PraticarInicio({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams, f = lerFiltros(sp)
  const sb = await supabaseServer()
  const [sync, gestor] = await Promise.all([sincronizarBancoGeral(sb), ehAdmin(sb)])
  const aviso = avisoDoBancoGeral(sync) // questões novas e correções do banco geral, antes de contar
  const hoje = hojeBR()
  const [{ data: todas, error }, { data: listas }, temas, { data: comTema }, refazer] = await Promise.all([
    todasAsLinhas((de, ate) => sb.from('banco_questoes').select('id,discipline_id,assunto,banca,ano,vezes,acertos,gabarito,anulada').order('id').range(de, ate), 20000),
    sb.from('provas').select('id,nome,criada_em,prova_tentativas(id,status,total,acertos)').eq('tipo', 'lista').order('criada_em', { ascending: false }).limit(8),
    carregarTemas(sb), todasAsLinhas((de, ate) => sb.from('banco_questoes').select('id,tema_id').not('tema_id', 'is', null).order('id').range(de, ate), 20000), // sem a 0040: vazias
    carregarFilaRefazer(sb, hoje, addDays(hoje, 7)), // null sem a 0039
  ])
  if (error) return (
    <div className="space-y-4"><h1 className="text-2xl font-semibold">Praticar</h1>
      <p className="rounded-2xl border border-warn/40 bg-warn/10 p-4 text-sm text-warn">Para usar o banco de questões, rode <code>supabase/migrations/0034_banco_questoes.sql</code> no SQL Editor do Supabase (depois da 0028) e recarregue a página.</p></div>)
  const temaDe = new Map(((comTema ?? []) as { id: string; tema_id: string }[]).map(q => [q.id, q.tema_id]))
  const T = (todas ?? []).map(q => ({ ...q, tema_id: temaDe.get(q.id) ?? null }))
  const feitas = T.filter(q => q.vezes > 0), acertosTot = T.reduce((s, q) => s + q.acertos, 0), vezesTot = T.reduce((s, q) => s + q.vezes, 0)
  const disponiveis = T.filter(q => q.gabarito && !q.anulada).length, semTema = T.filter(q => !q.tema_id).length
  const bancas = [...new Set(T.map(q => q.banca).filter(Boolean))].sort() as string[]
  const anos = [...new Set(T.map(q => q.ano).filter((a): a is number => !!a))].sort((a, b) => b - a)
  const card = (l: string, v: string) => <div className="rounded-2xl border border-line bg-surface p-4"><p className="text-sm text-muted">{l}</p><p className="mt-1 text-2xl font-semibold">{v}</p></div>
  const sel = inputCls + ' w-full'
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">Praticar</h1><p className="text-sm text-muted">Escolha o que estudar e responda uma por vez, com a resposta na hora.</p></div>
        {T.length > 0 && <Link href="/banco/questoes" className="rounded-xl border border-line px-4 py-2 text-sm hover:border-brand">Procurar questões</Link>}
      </div>
      {sp.erro && <AvisoDaUrl tipo="erro" chaves={['erro']}>{sp.erro}</AvisoDaUrl>}
      {aviso && <p role="status" className="rounded-xl border border-brand/40 bg-brand/10 p-3 text-sm">{aviso}</p>}

      {T.length === 0
        ? <div className="space-y-3 rounded-2xl border border-dashed border-line p-8 text-center">
          <p className="text-muted">{gestor ? 'Seu banco de questões está vazio. Importe um PDF ou .docx de questões (com o gabarito no fim) ou um pacote .json para começar a praticar.' : 'Ainda não há questões para praticar. Elas aparecem aqui assim que forem publicadas.'}</p>
          {gestor && <Link href="/admin/importar" className="inline-block rounded-xl bg-brand px-5 py-2.5 font-medium text-on-cor">Importar questões</Link>}
        </div>
        : <>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {card('Questões no banco', String(disponiveis))}{card('Já feitas', String(feitas.length))}
          {card('Acerto', vezesTot ? `${pct(acertosTot, vezesTot)}%` : '—')}
          {refazer && refazer.hoje > 0
            ? <Link href="/banco/praticar?revisao=1" className="rounded-2xl border border-brand/50 bg-surface p-4 hover:border-brand">
              <p className="text-sm text-muted">Para refazer hoje</p><p className="mt-1 text-2xl font-semibold">{refazer.hoje}</p>
              <p className="mt-1 text-xs text-brand">{refazer.atrasadas ? `${refazer.atrasadas} atrasada${refazer.atrasadas > 1 ? 's' : ''} · ` : ''}Refazer agora →</p></Link>
            : card('Para refazer hoje', refazer ? '0' : '—')}
        </div>

        <form className="grid gap-3 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-2 lg:grid-cols-5" action={montarLista}>
          <h2 className="font-medium sm:col-span-2 lg:col-span-5">O que você quer praticar?</h2>
          <label className="text-sm text-muted">Assunto<select name="assunto" defaultValue={f.tema ? `tema:${f.tema}` : f.assunto ?? ''} className={sel}><option value="">Todos</option>
            <OpcoesDeAssunto questoes={T} temas={temas} disciplina={f.disciplina} /></select></label>
          <label className="text-sm text-muted">Banca<select name="banca" defaultValue={f.banca ?? ''} className={sel}><option value="">Todas</option>{bancas.map(b => <option key={b} value={b}>{b}</option>)}</select></label>
          <fieldset className="text-sm text-muted"><legend>Ano da prova</legend><div className="flex items-center gap-1">
            <select name="de" defaultValue={f.anoDe ?? ''} aria-label="Ano: de" className={inputCls + ' min-w-0 flex-1'}><option value="">desde</option>{anos.map(a => <option key={a} value={a}>{a}</option>)}</select>–
            <select name="ate" defaultValue={f.anoAte ?? ''} aria-label="Ano: até" className={inputCls + ' min-w-0 flex-1'}><option value="">até</option>{anos.map(a => <option key={a} value={a}>{a}</option>)}</select></div></fieldset>
          <label className="text-sm text-muted">Situação<select name="situacao" defaultValue={f.situacao} className={sel}>
            <option value="todas">Todas</option><option value="nunca">Nunca fiz</option><option value="errei">Errei na última vez</option><option value="acertei">Acertei na última vez</option></select></label>
          <label className="text-sm text-muted">Quantas (lista)<select name="quantidade" defaultValue="10" className={sel}>{[5, 10, 20, 30, 50].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
          <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-5">
            <button formAction="/banco/praticar" formMethod="get" className="rounded-xl bg-brand px-5 py-2.5 font-medium text-on-cor">Praticar</button>
            <button className="rounded-xl border border-line px-4 py-2.5 text-sm hover:border-brand">Montar lista (como prova)</button>
            <button formAction="/banco/questoes" formMethod="get" className="rounded-xl border border-line px-4 py-2.5 text-sm hover:border-brand">Ver estas questões no Banco</button>
          </div>
          <p className="text-xs text-muted sm:col-span-2 lg:col-span-5"><b>Praticar</b>: uma questão por vez, com a resposta na hora; pode parar quando quiser. <b>Montar lista</b>: sorteia a quantidade escolhida e corrige só no fim, como uma prova. Nos dois, os erros vão para o Caderno de Erros e o resultado para o Desempenho. Só entram questões com gabarito.</p>
          {f.topico && <input type="hidden" name="topico" value={f.topico} />}{f.area && <input type="hidden" name="area" value={f.area} />}{f.disciplina && <input type="hidden" name="disciplina" value={f.disciplina} />}
        </form>

        {gestor && semTema > 0 && <p className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm">
          <span className="text-muted">{semTema} {semTema === 1 ? 'questão está' : 'questões estão'} sem tema: quem estuda não {semTema === 1 ? 'a acha' : 'as acha'} ao buscar por tema.</span>
          <Link href="/admin/questoes?adm=sem-tema" className="text-brand hover:underline">Resolver na Administração →</Link></p>}

        {(listas ?? []).length > 0 && <section className="space-y-2">
          <h2 className="font-medium">Listas recentes</h2>
          <ul className="grid gap-2 md:grid-cols-2">{(listas ?? []).map((l: any) => { const t = (l.prova_tentativas ?? [])[0]; return (
            <li key={l.id}><Link href={t ? `/provas/tentativa/${t.id}` : `/provas/${l.id}`} className="flex flex-wrap justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm hover:border-brand">
              <span>{l.nome}</span><span className="text-muted">{t?.status === 'corrigida' ? `${t.acertos}/${t.total} (${pct(t.acertos ?? 0, t.total ?? 0)}%)` : t ? 'em andamento' : ''} · {fmtData(String(l.criada_em).slice(0, 10))}</span></Link></li>) })}</ul>
        </section>}
      </>}
    </div>)
}
