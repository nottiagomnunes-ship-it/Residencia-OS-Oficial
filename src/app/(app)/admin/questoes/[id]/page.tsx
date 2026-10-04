import Link from 'next/link'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { salvarQuestao, excluirQuestaoDaAdmin, retirarDoBancoGeral, resolverReporte } from '@/lib/banco'
import { aplicarFiltros, assuntoDoFiltro, ehAdmin, carregarTemas, lerFiltroAdmin, aplicarFiltroAdmin, hashesReportados, carregarQuestaoPratica } from '@/lib/banco-data'
import { porEspecialidade } from '@/lib/engine/temas'
import { lerFiltros } from '@/lib/engine/banco'
import { LETRAS, ehLetra, type Alternativa } from '@/lib/engine/provas'
import { inputCls, fmtData } from '@/components/ui'
import AvisoDaUrl from '@/components/AvisoDaUrl'
import NovaFigura from '@/components/admin/NovaFigura'
import AssuntoDaQuestao, { type TopicoSimples } from '@/components/banco/AssuntoDaQuestao'

type Extra = { tema_id: string | null; explicacao: string | null; explicacao_origem: string | null; pendente_publicar: boolean | null }

/** A lista de onde a pessoa veio (com os filtros), só se for a lista da Administração. */
const lerLista = (v: string | undefined) => (v && /^\/admin\/questoes(\?[^\s]*)?$/.test(v) ? v : null)

/** Administração → editar uma questão: tudo numa página só, com Salvar e Salvar e publicar. */
export default async function EditarQuestao({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const sb = await supabaseServer()
  if (!(await ehAdmin(sb))) redirect('/banco/questoes')
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect('/admin/questoes')
  const lista = lerLista(sp.lista), voltaLista = lista ?? '/admin/questoes'
  const [{ data: q }, { data: extra }, pratica, temas, { data: ds }, { data: ts }] = await Promise.all([
    sb.from('banco_questoes').select('id,hash,blocos,alternativas,gabarito,gabarito_origem,anulada,banca,ano,assunto,discipline_id,topic_id,comentario,origem_geral,vezes,acertos').eq('id', id).maybeSingle(),
    sb.from('banco_questoes').select('tema_id,explicacao,explicacao_origem,pendente_publicar').eq('id', id).maybeSingle(), // sem a 0043: vem vazio
    carregarQuestaoPratica(sb, id), carregarTemas(sb),
    sb.from('disciplines').select('id,nome').order('ordem'), sb.from('topics').select('id,nome,discipline_id').limit(5000),
  ])
  if (!q) return (
    <div className="space-y-4"><Link href={voltaLista} className="text-sm text-muted hover:text-brand">← Questões</Link>
      <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">Essa questão não está mais no seu banco.</p></div>)
  const x = (extra ?? { tema_id: null, explicacao: null, explicacao_origem: null, pendente_publicar: null }) as Extra
  const urlDe = new Map((pratica?.blocos ?? []).flatMap(b => (b.tipo === 'imagem' && b.url ? [[b.caminho, b.url] as const] : [])))

  // anterior / próxima com os mesmos filtros da lista (a mesma ordem)
  const ps = Object.fromEntries(new URLSearchParams(lista?.split('?')[1] ?? '')), f = lerFiltros(ps), adm = lerFiltroAdmin(ps.adm)
  const [topico, reportadosAdm, { data: reportes }] = await Promise.all([
    assuntoDoFiltro(sb, f), adm === 'reportadas' ? hashesReportados(sb) : Promise.resolve([]),
    sb.from('explicacao_reportes').select('id,motivo,criado_em').eq('hash', q.hash).is('resolvido_em', null).order('criado_em'),
  ])
  const { data: ordem } = await aplicarFiltroAdmin(aplicarFiltros(sb.from('banco_questoes').select('id'), f, topico), adm, reportadosAdm)
    .order('ano', { ascending: false, nullsFirst: false }).order('criada_em', { ascending: false }).limit(2000)
  const ids = ((ordem ?? []) as { id: string }[]).map(r => r.id), pos = ids.indexOf(id)
  const comLista = (qid: string) => `/admin/questoes/${qid}${lista ? `?lista=${encodeURIComponent(lista)}` : ''}`
  const anterior = pos > 0 ? ids[pos - 1] : null, proxima = pos >= 0 && pos < ids.length - 1 ? ids[pos + 1] : null
  const volta = comLista(id)

  const alts = ((Array.isArray(q.alternativas) ? q.alternativas : []) as Alternativa[]).filter(a => ehLetra(a?.letra))
  const vagas = LETRAS.filter(l => !alts.some(a => a.letra === l)) // letras sem alternativa: dá para acrescentar
  const status = x.pendente_publicar ? ['Alterada, falta publicar', 'border-warn/50 text-warn'] : q.origem_geral ? ['Publicada no banco geral', 'border-info/50 text-info'] : ['Só no seu banco', 'border-line text-muted']
  const area = inputCls + ' w-full', sel = inputCls + ' w-full'
  const abertos = (reportes ?? []) as { id: string; motivo: string; criado_em: string }[]
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href={voltaLista} className="mr-auto text-muted hover:text-brand">← Questões</Link>
        {pos >= 0 && <span className="text-muted">{pos + 1} de {ids.length}{ids.length === 2000 ? '+' : ''}</span>}
        {anterior ? <Link href={comLista(anterior)} className="rounded-lg border border-line px-3 py-1.5 hover:border-brand">‹ Anterior</Link> : null}
        {proxima ? <Link href={comLista(proxima)} className="rounded-lg border border-line px-3 py-1.5 hover:border-brand">Próxima ›</Link> : null}
      </div>
      {sp.ok && <AvisoDaUrl tipo="ok" chaves={['ok']}>{sp.ok}</AvisoDaUrl>}
      {sp.erro && <AvisoDaUrl tipo="erro" chaves={['erro']}>{sp.erro}</AvisoDaUrl>}
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-semibold">Editar questão</h1>
        <span className={`rounded-full border px-3 py-1 text-xs ${status[1]}`}>{status[0]}</span>
        <span className="text-xs text-muted">{q.vezes ? `Você fez ${q.vezes}× (${q.acertos} certas)` : 'Você ainda não fez'}</span>
      </div>

      {abertos.length > 0 && <section className="space-y-2 rounded-2xl border border-danger/40 bg-surface p-4 text-sm">
        <h2 className="font-medium text-danger">Explicação reportada ({abertos.length})</h2>
        <ul className="space-y-2">{abertos.map(r => (
          <li key={r.id} className="flex flex-wrap items-center gap-2">
            <span className="flex-1">“{r.motivo}” <span className="text-xs text-muted">· {fmtData(r.criado_em.slice(0, 10))}</span></span>
            <form action={resolverReporte}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="volta" value={volta} />
              <button className="rounded-lg border border-line px-3 py-1.5 hover:border-brand">Marcar como resolvido</button></form>
          </li>))}</ul>
        <p className="text-xs text-muted">Corrija a explicação abaixo, clique em <b>Salvar e publicar</b> e marque como resolvido.</p>
      </section>}

      <form action={salvarQuestao} className="space-y-5">
        <input type="hidden" name="id" value={q.id} /><input type="hidden" name="volta" value={volta} />
        <section className="grid gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-[1fr_8rem_2fr]">
          <label className="text-sm text-muted">Banca<input name="banca" defaultValue={q.banca ?? ''} maxLength={120} className={sel} /></label>
          <label className="text-sm text-muted">Ano<input name="ano" type="number" min={1950} max={2100} defaultValue={q.ano ?? ''} className={sel} /></label>
          <label className="text-sm text-muted">Tema{temas.length
            ? <select name="tema" defaultValue={x.tema_id ?? ''} className={sel}><option value="">Sem tema</option>
                {porEspecialidade(temas).map(([e, l]) => <optgroup key={e} label={e}>{l.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}</optgroup>)}</select>
            : <span className="block py-2">Lista de temas vazia. <Link href="/admin/temas" className="text-brand hover:underline">Criar temas</Link></span>}</label>
        </section>

        <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
          <h2 className="font-medium">Enunciado</h2>
          {((q.blocos ?? []) as { tipo: string; texto?: string; caminho?: string }[]).map((b, k) => b.tipo === 'texto'
            ? <textarea key={k} name={`bloco_${k}`} defaultValue={b.texto} rows={Math.min(14, Math.max(3, Math.ceil((b.texto?.length ?? 0) / 90)))} aria-label={`Texto ${k + 1} do enunciado`} className={area} />
            : <figure key={k} className="rounded-xl border border-line p-2 text-xs text-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {urlDe.get(b.caminho!) ? <img src={urlDe.get(b.caminho!)} alt={`Figura ${k + 1} do enunciado`} className="max-h-72 rounded-lg" /> : <span>[figura]</span>}
                <figcaption className="mt-1 flex items-center gap-2"><label className="flex items-center gap-2 text-danger"><input type="checkbox" name="remover_figura" value={k} className="size-4" />Tirar esta figura</label></figcaption></figure>)}
          <NovaFigura trechos={((q.blocos ?? []) as { tipo: string; texto?: string }[]).flatMap((b, k) => (b.tipo === 'texto'
            ? [{ indice: k, rotulo: `Depois de “${(b.texto ?? '').slice(0, 50)}${(b.texto ?? '').length > 50 ? '…' : ''}”` }] : [{ indice: k, rotulo: `Depois da figura ${k + 1}` }]))} />
          <p className="text-xs text-muted">Apagar todo o texto de um trecho tira esse trecho.</p>
        </section>

        <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
          <h2 className="font-medium">Alternativas</h2>
          {alts.map(a => (
            <label key={a.letra} className="flex items-start gap-2"><b className="mt-2 w-5">{a.letra})</b>
              <input type="hidden" name="alt_letra" value={a.letra} />
              <textarea name="alt_texto" defaultValue={a.texto} rows={Math.min(6, Math.max(1, Math.ceil(a.texto.length / 90)))} aria-label={`Alternativa ${a.letra}`} className={area} /></label>))}
          {vagas.length > 0 && <details className="text-sm"><summary className="cursor-pointer text-muted">Acrescentar alternativa</summary>
            {vagas.map(l => (
              <label key={l} className="mt-2 flex items-start gap-2"><b className="mt-2 w-5">{l})</b>
                <input type="hidden" name="alt_letra" value={l} />
                <textarea name="alt_texto" rows={1} aria-label={`Alternativa ${l} (nova)`} className={area} /></label>))}</details>}
          <p className="text-xs text-muted">Apagar o texto de uma alternativa tira essa alternativa.</p>
          <div className="flex flex-wrap items-end gap-4 border-t border-line pt-3">
            <label className="text-sm text-muted">Gabarito<select name="gabarito" defaultValue={q.gabarito ?? ''} className={inputCls + ' ml-2'}>
              <option value="">Sem gabarito</option>{LETRAS.map(l => <option key={l} value={l}>{l}</option>)}</select></label>
            {q.gabarito_origem === 'ia' && <span className="text-xs text-warn">Gabarito sugerido pela IA: confira (salvar outro deixa como oficial).</span>}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="anulada" value="1" defaultChecked={q.anulada} className="size-4 accent-brand" />Questão anulada</label>
          </div>
        </section>

        <section className="space-y-2 rounded-2xl border border-line bg-surface p-4">
          <h2 className="font-medium">Explicação <span className="text-sm font-normal text-muted">· vai para todas as contas{x.explicacao_origem === 'ia' ? ' · escrita pela IA (ao mudar, fica "revisada")' : x.explicacao_origem === 'revisada' ? ' · revisada' : ''}</span></h2>
          <textarea name="explicacao" defaultValue={x.explicacao ?? ''} rows={8} placeholder="Por que a resposta certa é a certa e onde as outras erram." className={area} />
        </section>

        <section className="space-y-2 rounded-2xl border border-line bg-surface p-4">
          <h2 className="font-medium">Comentário particular <span className="text-sm font-normal text-muted">· só no seu banco, nunca é publicado</span></h2>
          <textarea name="comentario" defaultValue={q.comentario ?? ''} rows={4} className={area} />
        </section>

        <div className="sticky bottom-2 z-10 flex flex-wrap gap-2 rounded-2xl border border-line bg-surface/95 p-3 shadow-lg">
          <button name="intencao" value="salvar" className="rounded-xl border border-line px-5 py-2.5 hover:border-brand">Salvar</button>
          <button name="intencao" value="publicar" className="rounded-xl bg-brand px-5 py-2.5 font-medium text-black">{q.origem_geral ? 'Salvar e atualizar no banco geral' : 'Salvar e publicar'}</button>
        </div>
      </form>

      <details className="rounded-2xl border border-line bg-surface p-4 text-sm">
        <summary className="cursor-pointer font-medium">Assunto das suas Matérias <span className="font-normal text-muted">· só para o seu Desempenho; as outras contas usam o tema</span></summary>
        <div className="mt-3"><AssuntoDaQuestao id={q.id} topicId={q.topic_id} assunto={q.assunto} disciplinaId={q.discipline_id} assuntos={(ts ?? []) as TopicoSimples[]} disciplinas={(ds ?? []) as { id: string; nome: string }[]} /></div>
      </details>

      <section className="flex flex-wrap items-center gap-3 border-t border-line pt-4 text-sm">
        {q.origem_geral && <form action={retirarDoBancoGeral}><input type="hidden" name="sel" value={q.id} /><input type="hidden" name="volta" value={volta} />
          <button className="rounded-lg border border-line px-3 py-1.5 text-danger hover:border-danger">Tirar do banco geral</button></form>}
        <form action={excluirQuestaoDaAdmin}><input type="hidden" name="id" value={q.id} /><input type="hidden" name="lista" value={voltaLista} />
          <button className="rounded-lg px-3 py-1.5 text-danger hover:underline">Excluir do seu banco</button></form>
      </section>
    </div>)
}
