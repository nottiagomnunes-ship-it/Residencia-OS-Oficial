import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { carregarProva } from '@/lib/provas-data'
import { salvarGabarito, definirAreaPorFaixa, iniciarTentativa, excluirProva } from '@/lib/provas'
import { gabaritoEmTexto, faixas, textoDosBlocos, relogio } from '@/lib/engine/provas'
import { AREAS, ROTULO_AREA, SIGLA_AREA, COR_AREA } from '@/lib/engine/areas'
import { pct } from '@/lib/engine/desempenho'
import { fmtData, inputCls } from '@/components/ui'
import AvisoDaUrl from '@/components/AvisoDaUrl'

export default async function Prova({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const [{ id }, { ok, erro }] = await Promise.all([params, searchParams])
  const sb = await supabaseServer()
  const dados = await carregarProva(sb, id, false)
  if (!dados) notFound()
  const { prova, questoes } = dados
  const { data: ts } = await sb.from('prova_tentativas').select('id,status,tempo_seg,atual,total,acertos,iniciada_em,corrigida_em').eq('prova_id', id).order('iniciada_em', { ascending: false })
  const semGab = questoes.filter(q => !q.anulada && !q.gabarito).map(q => q.numero), anuladas = questoes.filter(q => q.anulada).map(q => q.numero)
  const aberta = (ts ?? []).find(t => t.status !== 'corrigida')
  const porArea = [...AREAS, null].map(a => ({ a, n: questoes.filter(q => q.area === a).length })).filter(x => x.n > 0)
  const card = 'space-y-3 rounded-2xl border border-line bg-surface p-5'
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/provas" className="text-sm text-muted hover:text-brand">← Provas</Link>
        <h1 className="text-2xl font-semibold">{prova.nome}</h1>
        <p className="text-sm text-muted">{questoes.length} questões{prova.banca ? ` · ${prova.banca}` : ''}{prova.ano ? ` · ${prova.ano}` : ''}
          {prova.tipo === 'prova' && !prova.doBanco && <> · <Link href={`/contato?${new URLSearchParams({ pedir: 'prova', ...(prova.banca ? { banca: prova.banca } : {}), ...(prova.ano ? { ano: String(prova.ano) } : {}) })}#pedir-prova`} className="text-brand underline">Pedir esta prova para o banco de questões</Link></>}</p>
      </div>
      {ok && <AvisoDaUrl tipo="ok" chaves={['ok']}>{ok}</AvisoDaUrl>}
      {erro && <AvisoDaUrl tipo="erro" chaves={['erro']}>{erro}</AvisoDaUrl>}

      <div className="flex flex-wrap gap-2">
        {aberta
          ? <Link href={`/provas/tentativa/${aberta.id}`} className="rounded-xl bg-brand px-5 py-3 font-medium text-on-cor">{aberta.status === 'entregue' ? 'Corrigir' : `Continuar (questão ${aberta.atual})`}</Link>
          : <form action={iniciarTentativa}><input type="hidden" name="prova" value={id} /><button className="rounded-xl bg-brand px-5 py-3 font-medium text-on-cor">Começar a prova</button></form>}
      </div>

      {prova.doBanco && <p className="rounded-xl border border-line bg-surface p-3 text-sm text-muted">Prova montada a partir do banco de questões: o gabarito, as figuras e as explicações vêm do banco. Para fazer de novo com as correções mais recentes do banco, use &quot;Refazer a prova&quot; em Provas.</p>}
      {!prova.doBanco && <div className="space-y-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0">
        <form action={salvarGabarito} className={card}>
          <input type="hidden" name="prova" value={id} />
          <h2 className="font-medium">Gabarito</h2>
          <p className="text-sm">{semGab.length ? <span className="text-warn">Faltam: {faixas(semGab)}.</span> : <span className="text-brand">Completo.</span>}
            {anuladas.length > 0 && <span className="text-muted"> Anuladas: {faixas(anuladas)}.</span>}</p>
          <textarea name="gabarito" rows={6} defaultValue={gabaritoEmTexto(questoes)} placeholder="1-B 2-C 3-A ... (anulada: X)" className={inputCls + ' w-full font-mono'} />
          <p className="text-xs text-muted">Só as questões que aparecem no texto são alteradas. Mudar o gabarito não muda provas já corrigidas.</p>
          <button className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-on-cor">Salvar gabarito</button>
        </form>

        <section className={card}>
          <h2 className="font-medium">Áreas</h2>
          <div className="flex flex-wrap gap-2 text-sm">{porArea.map(({ a, n }) => (
            <span key={a ?? 'sem'} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1">
              <span aria-hidden className="size-2.5 rounded-full" style={{ background: a ? COR_AREA[a] : 'var(--c-muted)' }} />{a ? SIGLA_AREA[a] : 'Sem área'}: {n}</span>))}</div>
          <form action={definirAreaPorFaixa} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="prova" value={id} />
            <label className="text-sm text-muted">De<input name="de" required inputMode="numeric" className={inputCls + ' mt-1 block w-20'} /></label>
            <label className="text-sm text-muted">Até<input name="ate" required inputMode="numeric" className={inputCls + ' mt-1 block w-20'} /></label>
            <label className="text-sm text-muted">Área<select name="area" className={inputCls + ' mt-1 block'}><option value="">Sem área</option>{AREAS.map(a => <option key={a} value={a}>{ROTULO_AREA[a]}</option>)}</select></label>
            <button className="min-h-11 rounded-xl border border-line px-4 text-sm hover:border-brand">Aplicar</button>
          </form>
          <details>
            <summary className="cursor-pointer text-sm text-muted">Ver as questões</summary>
            <ul className="mt-2 divide-y divide-line text-sm">{questoes.map(q => (
              <li key={q.id} className="flex items-center gap-2 py-1.5">
                <span className="min-w-0 flex-1 truncate"><b>{q.numero}.</b> {textoDosBlocos(q.blocos).slice(0, 120)}</span>
                <span className="shrink-0 text-xs text-muted">{q.area ? SIGLA_AREA[q.area] : 'Sem área'}</span>
                <span className="w-6 shrink-0 text-right font-mono">{q.anulada ? 'X' : q.gabarito ?? '·'}</span>
              </li>))}</ul>
          </details>
        </section>
      </div>}

      {(ts ?? []).length > 0 && (
        <section className="space-y-2">
          <h2 className="font-medium">Tentativas</h2>
          <ul className="space-y-2">{(ts ?? []).map(t => (
            <li key={t.id}><Link href={`/provas/tentativa/${t.id}`} className="flex flex-wrap justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm hover:border-brand">
              <span>{fmtData(t.iniciada_em.slice(0, 10))} · {t.status === 'corrigida' ? 'Corrigida' : t.status === 'entregue' ? 'Entregue, falta gabarito' : 'Em andamento'}</span>
              <span className="text-muted">{t.status === 'corrigida' ? `${t.acertos}/${t.total} (${pct(t.acertos ?? 0, t.total ?? 0)}%) · ` : ''}{relogio(t.tempo_seg)}</span>
            </Link></li>))}</ul>
        </section>)}

      <details className="rounded-2xl border border-line p-4">
        <summary className="cursor-pointer text-sm text-danger">Excluir prova…</summary>
        <form action={excluirProva} className="mt-3 space-y-2">
          <input type="hidden" name="prova" value={id} />
          <p className="text-sm text-muted">Apaga a prova e as tentativas{prova.doBanco ? '' : ' e as figuras'}. Os resultados em Simulados e as anotações no Caderno de Erros continuam.</p>
          <button className="rounded-xl border border-danger px-4 py-2 text-sm text-danger hover:bg-danger/10">Excluir definitivamente</button>
        </form>
      </details>
    </div>)
}
