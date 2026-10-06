import Link from 'next/link'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { definirTemaEmLote, sugerirTemasPeloTexto, publicarNoBancoGeral, retirarDoBancoGeral, restaurarDoBancoGeral } from '@/lib/banco'
import { aplicarFiltros, assuntoDoFiltro, ehAdmin, carregarTemas, FILTROS_ADMIN, lerFiltroAdmin, aplicarFiltroAdmin, hashesReportados } from '@/lib/banco-data'
import { porEspecialidade } from '@/lib/engine/temas'
import OpcoesDeAssunto from '@/components/banco/OpcoesDeAssunto'
import { lerFiltros, filtrosParaUrl, type Filtros } from '@/lib/engine/banco'
import { textoDosBlocos, type Bloco } from '@/lib/engine/provas'
import { inputCls } from '@/components/ui'
import AvisoDaUrl from '@/components/AvisoDaUrl'
import MarcarTodas from '@/components/banco/MarcarTodas'
import BarraDoLote from '@/components/admin/BarraDoLote'
import { todasAsLinhas } from '@/lib/paginar'

const POR_PAGINA = 30
type Linha = { id: string; blocos: Bloco[]; gabarito: string | null; anulada: boolean; assunto: string | null; banca: string | null; ano: number | null
  tema_id?: string | null; origem_geral?: string | null; explicacao?: string | null; pendente_publicar?: boolean | null; hash?: string }

/** Administração → Questões: achar as questões (com os filtros do que falta fazer), mexer em várias de uma vez ou abrir uma para editar. */
export default async function AdminQuestoes({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams, f = lerFiltros(sp), adm = lerFiltroAdmin(sp.adm), pagina = Math.max(1, Number(sp.p) || 1)
  const sb = await supabaseServer()
  if (!(await ehAdmin(sb))) redirect('/banco/questoes')
  const [topico, reportados] = await Promise.all([assuntoDoFiltro(sb, f), adm === 'reportadas' ? hashesReportados(sb) : Promise.resolve([])])
  const consulta = (campos: string) => aplicarFiltroAdmin(aplicarFiltros(sb.from('banco_questoes').select(campos, { count: 'exact' }), f, topico), adm, reportados)
    .order('ano', { ascending: false, nullsFirst: false }).order('criada_em', { ascending: false }).range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1)
  const [{ data: todas, error }, primeira, temas, { data: colecoes }, { count: removidas }, { data: comTema }] = await Promise.all([
    todasAsLinhas((de, ate) => sb.from('banco_questoes').select('id,assunto,banca,ano').order('id').range(de, ate), 20000),
    consulta('id,blocos,gabarito,anulada,assunto,banca,ano,tema_id,origem_geral,explicacao,pendente_publicar,hash'),
    carregarTemas(sb),
    todasAsLinhas((de, ate) => sb.from('banco_geral').select('colecao').not('colecao', 'is', null).order('id').range(de, ate), 5000),
    sb.from('banco_geral_removidas').select('geral_id', { count: 'exact', head: true }),
    todasAsLinhas((de, ate) => sb.from('banco_questoes').select('id,tema_id').not('tema_id', 'is', null).order('id').range(de, ate), 20000), // separada: sem a 0040, vem vazia
  ])
  if (error) return (
    <div className="space-y-4"><h1 className="text-2xl font-semibold">Questões</h1>
      <p className="rounded-2xl border border-warn/40 bg-warn/10 p-4 text-sm text-warn">Para usar o banco de questões, rode <code>supabase/migrations/0034_banco_questoes.sql</code> no SQL Editor do Supabase e recarregue a página.</p></div>)
  // sem a 0043 (ou 0040/0042) a consulta completa falha: a lista segue com o básico, sem as marcas e sem o filtro da Administração
  const faltaMigracao = !!primeira.error
  const { data: lista, count } = faltaMigracao
    ? await aplicarFiltros(sb.from('banco_questoes').select('id,blocos,gabarito,anulada,assunto,banca,ano,origem_geral', { count: 'exact' }), f, topico)
      .order('ano', { ascending: false, nullsFirst: false }).order('criada_em', { ascending: false }).range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1)
    : primeira
  const temaDe = new Map(((comTema ?? []) as { id: string; tema_id: string }[]).map(q => [q.id, q.tema_id]))
  const T = (todas ?? []).map(q => ({ ...q, tema_id: temaDe.get(q.id) ?? null }))
  const nomeTema = new Map(temas.map(t => [t.id, t.nome]))
  const contar = (xs: (string | null)[]) => { const m = new Map<string, number>(); for (const x of xs) if (x) m.set(x, (m.get(x) ?? 0) + 1); return m }
  const bancas = [...contar(T.map(q => q.banca))].sort((a, b) => a[0].localeCompare(b[0]))
  const anos = [...new Set(T.map(q => q.ano).filter((a): a is number => !!a))].sort((a, b) => b - a)
  const nomesColecoes = [...new Set(((colecoes ?? []) as { colecao: string }[]).map(c => c.colecao))].sort()
  const linhas = (lista ?? []) as unknown as Linha[], total = count ?? 0, paginas = Math.max(1, Math.ceil(total / POR_PAGINA))
  const qsLista = (o: Partial<Filtros> & { p?: number; adm?: string | null }) => {
    const a = o.adm === undefined ? adm : o.adm
    return [filtrosParaUrl({ ...f, ...o }), a ? `adm=${a}` : '', o.p && o.p > 1 ? `p=${o.p}` : ''].filter(Boolean).join('&')
  }
  const url = (o: Partial<Filtros> & { p?: number; adm?: string | null }) => { const qs = qsLista(o); return qs ? `/admin/questoes?${qs}` : '/admin/questoes' }
  const volta = url({ p: pagina }), filtrosLote = qsLista({})
  const filtrado = !!(f.area || f.disciplina || f.assunto || f.topico || f.banca || f.anoDe || f.anoAte || adm)
  const sel = inputCls + ' w-full', btn = 'rounded-xl border border-line px-4 py-2 text-sm hover:border-brand'
  const marca = (cor: string, txt: string) => <span className={`rounded-full border px-2 py-0.5 text-xs ${cor}`}>{txt}</span>
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">Questões</h1><p className="text-sm text-muted">Ache as questões, mexa em várias de uma vez ou clique em <b>Editar</b> para mudar tudo de uma.</p></div>
        <Link href="/admin/importar" className={btn}>Importar questões</Link>
      </div>
      {sp.ok && <AvisoDaUrl tipo="ok" chaves={['ok']}>{sp.ok}</AvisoDaUrl>}
      {sp.erro && <AvisoDaUrl tipo="erro" chaves={['erro']}>{sp.erro}</AvisoDaUrl>}
      {faltaMigracao && <p className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm text-warn">Para ver o que falta fazer em cada questão (tema, explicação, falta publicar), rode <code>supabase/migrations/0043_admin_pendencias.sql</code> no SQL Editor do Supabase (depois da 0040 e da 0042).</p>}

      {T.length === 0
        ? <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">O banco está vazio. <Link href="/admin/importar" className="text-brand hover:underline">Importe questões</Link> para começar.</p>
        : <>
        <form action="/admin/questoes" method="get" className="space-y-3 rounded-2xl border border-line bg-surface p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm text-muted">O que falta<select name="adm" defaultValue={adm ?? ''} className={sel}><option value="">Todas as questões</option>
              {FILTROS_ADMIN.map(([k, r]) => <option key={k} value={k}>{r}</option>)}</select></label>
            <label className="text-sm text-muted">Banca<select name="banca" defaultValue={f.banca ?? ''} className={sel}><option value="">Todas</option>{bancas.map(([b, n]) => <option key={b} value={b}>{b} ({n})</option>)}</select></label>
            <label className="text-sm text-muted">Tema / assunto<select name="assunto" defaultValue={f.tema ? `tema:${f.tema}` : f.assunto ?? ''} className={sel}><option value="">Todos</option>
              <OpcoesDeAssunto questoes={T} temas={temas} disciplina={f.disciplina} /></select></label>
            <fieldset className="text-sm text-muted"><legend>Ano</legend><div className="flex items-center gap-1">
              <select name="de" defaultValue={f.anoDe ?? ''} aria-label="Ano: de" className={inputCls + ' min-w-0 flex-1'}><option value="">desde</option>{anos.map(a => <option key={a} value={a}>{a}</option>)}</select>–
              <select name="ate" defaultValue={f.anoAte ?? ''} aria-label="Ano: até" className={inputCls + ' min-w-0 flex-1'}><option value="">até</option>{anos.map(a => <option key={a} value={a}>{a}</option>)}</select></div></fieldset>
          </div>
          {f.area && <input type="hidden" name="area" value={f.area} />}{f.disciplina && <input type="hidden" name="disciplina" value={f.disciplina} />}
          {f.topico && <input type="hidden" name="topico" value={f.topico} />}
          <div className="flex flex-wrap gap-2">
            <button className="rounded-xl bg-brand px-5 py-2 font-medium text-on-cor">Buscar</button>
            {filtrado && <Link href="/admin/questoes" className={btn}>Limpar</Link>}
          </div>
        </form>

        <form id="lote" action={definirTemaEmLote}><input type="hidden" name="filtros" value={filtrosLote} /><input type="hidden" name="volta" value={volta} /></form>
        <BarraDoLote form="lote">
          <div className="flex flex-wrap items-end gap-2">
            {temas.length ? <>
              <label className="min-w-56 flex-1 text-muted">Tema<select name="tema" form="lote" defaultValue="" className={sel}>
                <option value="">Escolha o tema…</option>
                {porEspecialidade(temas).map(([e, l]) => <optgroup key={e} label={e}>{l.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}</optgroup>)}
                <option value="nenhum">Sem tema (tirar)</option>
              </select></label>
              <button form="lote" formAction={definirTemaEmLote} className="rounded-xl bg-brand px-4 py-2 font-medium text-on-cor">Dar o tema</button>
              <button form="lote" formAction={sugerirTemasPeloTexto} className="rounded-xl border border-line px-4 py-2 hover:border-brand">Sugerir tema pelo texto</button>
            </> : <p className="text-muted">A lista de temas está vazia: <Link href="/admin/temas" className="text-brand hover:underline">crie os temas</Link>.</p>}
          </div>
          <div className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
            <label className="min-w-48 flex-1 text-muted">Coleção (opcional)<input name="colecao" form="lote" list="colecoes" maxLength={120} placeholder="Ex.: Anestesiologia – UFMA" className={sel} /></label>
            <datalist id="colecoes">{nomesColecoes.map(c => <option key={c} value={c} />)}</datalist>
            <button form="lote" formAction={publicarNoBancoGeral} className="rounded-xl border border-brand px-4 py-2 text-brand">Publicar no banco geral</button>
            <button form="lote" formAction={retirarDoBancoGeral} className="rounded-xl px-3 py-2 text-danger hover:underline">Tirar do banco geral</button>
          </div>
          <p className="text-xs text-muted">Publicar manda o enunciado, as figuras, as alternativas, o gabarito, o tema e a explicação; o comentário <b>não</b> vai. Publicar de novo atualiza a cópia das outras contas.</p>
        </BarraDoLote>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h2 className="mr-auto text-lg font-medium">{total} {total === 1 ? 'questão' : 'questões'}</h2>
            {total > 0 && <a href={`/admin/exportar${filtrosLote ? `?${filtrosLote}` : ''}`} className="text-sm text-muted hover:text-brand">Exportar estas (.json)</a>}
          </div>
          {linhas.length > 0 && <MarcarTodas form="lote" total={total} naPagina={linhas.length} />}
          {!total && <p className="rounded-2xl border border-dashed border-line p-6 text-center text-muted">{adm ? 'Nada pendente aqui.' : 'Nenhuma questão com esses filtros.'}</p>}
          <ul className="space-y-2">{linhas.map(q => {
            const texto = textoDosBlocos((q.blocos ?? []).filter(b => b.tipo === 'texto')), comFigura = (q.blocos ?? []).some(b => b.tipo === 'imagem')
            const editar = `/admin/questoes/${q.id}${volta !== '/admin/questoes' ? `?lista=${encodeURIComponent(volta)}` : ''}`
            return (
              <li key={q.id} className="flex items-start gap-3 rounded-xl border border-line bg-surface p-3 text-sm">
                <input type="checkbox" name="sel" value={q.id} form="lote" aria-label="Marcar esta questão" className="mt-1 size-4 shrink-0 accent-brand" />
                <Link href={editar} className="min-w-0 flex-1 space-y-1 hover:text-brand">
                  <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <span className="font-medium text-inherit">{[q.banca, q.ano].filter(Boolean).join(' ') || 'Sem banca'}</span>
                    <span>· {(q.tema_id && nomeTema.get(q.tema_id)) ?? q.assunto ?? 'sem assunto'}</span>
                    {!faltaMigracao && <>
                      {q.pendente_publicar ? marca('border-warn/50 text-warn', 'alterada, falta publicar') : q.origem_geral ? marca('border-info/50 text-info', 'publicada') : marca('border-line', 'só no seu banco')}
                      {!q.tema_id && marca('border-line', 'sem tema')}
                      {!q.explicacao && !q.anulada && q.gabarito && marca('border-line', 'sem explicação')}
                    </>}
                    {q.anulada ? marca('border-warn/50 text-warn', 'anulada') : !q.gabarito && marca('border-warn/50 text-warn', 'sem gabarito')}
                    {comFigura && marca('border-line', 'com figura')}
                  </span>
                  <span className="block text-inherit">{texto.slice(0, 200)}{texto.length > 200 ? '…' : ''}</span>
                </Link>
                <Link href={editar} className="shrink-0 rounded-lg border border-line px-3 py-1.5 hover:border-brand">Editar</Link>
              </li>)
          })}</ul>
          {paginas > 1 && <nav className="flex items-center gap-2 text-sm" aria-label="Páginas">
            {pagina > 1 && <Link href={url({ p: pagina - 1 })} className="rounded-lg border border-line px-3 py-1.5">‹ Anterior</Link>}
            <span className="text-muted">Página {pagina} de {paginas}</span>
            {pagina < paginas && <Link href={url({ p: pagina + 1 })} className="rounded-lg border border-line px-3 py-1.5">Próxima ›</Link>}
          </nav>}
        </section>


        {!!removidas && <form action={restaurarDoBancoGeral} className="flex flex-wrap items-center gap-2 text-sm">
          <input type="hidden" name="volta" value={volta} />
          <span className="flex-1 text-muted">Você excluiu {removidas} {removidas === 1 ? 'questão' : 'questões'} do banco geral do seu banco.</span>
          <button className="rounded-lg border border-line px-3 py-1.5 hover:border-brand">Trazer de volta</button>
        </form>}
      </>}
    </div>)
}
