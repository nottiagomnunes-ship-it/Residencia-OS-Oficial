import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import { excluirDoBanco, restaurarDoBancoGeral } from '@/lib/banco'
import { aplicarFiltros, assuntoDoFiltro, sincronizarBancoGeral, ehAdmin, avisoDoBancoGeral, carregarTemas } from '@/lib/banco-data'
import OpcoesDeAssunto from '@/components/banco/OpcoesDeAssunto'
import { lerFiltros, filtrosParaUrl, type Filtros } from '@/lib/engine/banco'
import { textoDosBlocos, ehLetra, type Bloco } from '@/lib/engine/provas'
import { BUCKET } from '@/lib/provas-data'
import { inputCls } from '@/components/ui'
import AvisoDaUrl from '@/components/AvisoDaUrl'
import ExplicacaoDaQuestao from '@/components/banco/ExplicacaoDaQuestao'

const POR_PAGINA = 30
type Linha = { id: string; blocos: Bloco[]; alternativas: { letra: string; texto: string }[]; gabarito: string | null; gabarito_origem: string | null; anulada: boolean
  comentario: string | null; area: string | null; discipline_id: string | null; topic_id: string | null; assunto: string | null; banca: string | null; ano: number | null
  vezes: number; acertos: number; ultimo_certo: boolean | null }

/** Banco: procurar questões (banca, assunto, ano) e praticar. É igual para todas as contas; editar e publicar ficam na Administração (/admin). */
export default async function BancoDeQuestoes({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams, f = lerFiltros(sp), pagina = Math.max(1, Number(sp.p) || 1)
  const sb = await supabaseServer()
  // primeiro o banco geral (questões novas e correções), para a lista já vir com elas
  const [sync, topico, admin] = await Promise.all([sincronizarBancoGeral(sb), assuntoDoFiltro(sb, f), ehAdmin(sb)])
  const aviso = avisoDoBancoGeral(sync), daPagina = <T,>(q: T) => (aplicarFiltros(q, f, topico) as any).order('ano', { ascending: false, nullsFirst: false }).order('criada_em', { ascending: false }).range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1)
  // separadas: sem a 0037/0040/0042, estas falham e a página segue sem elas
  const [{ data: todas, error }, { data: lista, count }, { count: removidas }, temas, { data: comTema }, { data: explDaPagina }] = await Promise.all([
    sb.from('banco_questoes').select('id,discipline_id,assunto,banca,ano').limit(20000),
    daPagina(sb.from('banco_questoes').select('id,blocos,alternativas,gabarito,gabarito_origem,anulada,comentario,area,discipline_id,topic_id,assunto,banca,ano,vezes,acertos,ultimo_certo', { count: 'exact' })),
    sync ? sb.from('banco_geral_removidas').select('geral_id', { count: 'exact', head: true }) : Promise.resolve({ count: 0 }),
    carregarTemas(sb),
    sb.from('banco_questoes').select('id,tema_id').not('tema_id', 'is', null).limit(20000),
    daPagina(sb.from('banco_questoes').select('id,explicacao,explicacao_origem')),
  ])
  if (error) return (
    <div className="space-y-4"><h1 className="text-2xl font-semibold">Banco de questões</h1>
      <p className="rounded-2xl border border-warn/40 bg-warn/10 p-4 text-sm text-warn">Para usar o banco de questões, rode <code>supabase/migrations/0034_banco_questoes.sql</code> no SQL Editor do Supabase (depois da 0028) e recarregue a página.</p></div>)
  const temaDe = new Map(((comTema ?? []) as { id: string; tema_id: string }[]).map(q => [q.id, q.tema_id]))
  const T = (todas ?? []).map(q => ({ ...q, tema_id: temaDe.get(q.id) ?? null }))
  /** Valores de um campo com quantas questões têm cada um (para os seletores: "UFMA (120)"). */
  const contar = (xs: (string | null)[]) => { const m = new Map<string, number>(); for (const x of xs) if (x) m.set(x, (m.get(x) ?? 0) + 1); return m }
  const bancas = [...contar(T.map(q => q.banca))].sort((a, b) => a[0].localeCompare(b[0]))
  const anos = [...new Set(T.map(q => q.ano).filter((a): a is number => !!a))].sort((a, b) => b - a)
  const expl = new Map(((explDaPagina ?? []) as { id: string; explicacao: string | null; explicacao_origem: string | null }[]).map(q => [q.id, q]))
  const linhas = (lista ?? []) as Linha[], total = count ?? 0, paginas = Math.max(1, Math.ceil(total / POR_PAGINA))
  // as figuras das questões desta página (links temporários; as do banco geral ficam na pasta "geral/")
  const caminhos = [...new Set(linhas.flatMap(q => (q.blocos ?? []).flatMap(b => (b.tipo === 'imagem' ? [b.caminho] : []))))]
  const urlDe = new Map<string, string>()
  if (caminhos.length) {
    const { data: urls } = await sb.storage.from(BUCKET).createSignedUrls(caminhos, 60 * 60 * 6)
    for (const u of urls ?? []) if (u.path && u.signedUrl) urlDe.set(u.path, u.signedUrl)
  }
  const soTexto = (bs: Bloco[]) => textoDosBlocos(bs.filter(b => b.tipo === 'texto'))
  const url = (o: Partial<Filtros> & { p?: number }) => {
    const qs = [filtrosParaUrl({ ...f, ...o }), o.p && o.p > 1 ? `p=${o.p}` : ''].filter(Boolean).join('&')
    return qs ? `/banco/questoes?${qs}` : '/banco/questoes'
  }
  const volta = url({ p: pagina }), filtrado = !!(f.area || f.disciplina || f.assunto || f.topico || f.banca || f.anoDe || f.anoAte || f.situacao !== 'todas')
  const praticar = `/banco/praticar${filtrosParaUrl(f) ? `?${filtrosParaUrl(f)}` : ''}`
  const sel = inputCls + ' w-full', btn = 'rounded-xl border border-line px-4 py-2 text-sm hover:border-brand'
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">Banco de questões</h1><p className="text-sm text-muted">Procure questões por banca, assunto e ano.</p></div>
        {admin && <Link href="/admin/questoes" className="rounded-xl border border-line px-4 py-2 text-sm hover:border-brand">Editar na Administração</Link>}
      </div>
      {sp.ok && <AvisoDaUrl tipo="ok" chaves={['ok']}>{sp.ok}</AvisoDaUrl>}
      {sp.erro && <AvisoDaUrl tipo="erro" chaves={['erro']}>{sp.erro}</AvisoDaUrl>}
      {aviso && <p role="status" className="rounded-xl border border-brand/40 bg-brand/10 p-3 text-sm">{aviso}</p>}

      {T.length === 0
        ? <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">{admin ? <>O banco está vazio. <Link href="/admin/importar" className="text-brand hover:underline">Importe questões</Link> na Administração.</> : 'Ainda não há questões no banco. Elas aparecem aqui assim que forem publicadas.'}</p>
        : <>
        <form action="/banco/questoes" method="get" className="space-y-3 rounded-2xl border border-line bg-surface p-4 md:p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1.4fr_auto]">
            <label className="text-sm text-muted">Banca<select name="banca" defaultValue={f.banca ?? ''} className={sel}><option value="">Todas as bancas</option>{bancas.map(([b, n]) => <option key={b} value={b}>{b} ({n})</option>)}</select></label>
            <label className="text-sm text-muted">Assunto<select name="assunto" defaultValue={f.tema ? `tema:${f.tema}` : f.assunto ?? ''} className={sel}><option value="">Todos os assuntos</option>
              <OpcoesDeAssunto questoes={T} temas={temas} disciplina={f.disciplina} /></select></label>
            <fieldset className="text-sm text-muted sm:col-span-2 lg:col-span-1"><legend>Ano da prova</legend>
              <div className="flex items-center gap-2">
                <select name="de" defaultValue={f.anoDe ?? ''} aria-label="Ano: de" className={inputCls}><option value="">desde sempre</option>{anos.map(a => <option key={a} value={a}>{a}</option>)}</select>
                <span>até</span>
                <select name="ate" defaultValue={f.anoAte ?? ''} aria-label="Ano: até" className={inputCls}><option value="">hoje</option>{anos.map(a => <option key={a} value={a}>{a}</option>)}</select>
              </div></fieldset>
          </div>
          <label className="block max-w-xs text-sm text-muted">Situação<select name="situacao" defaultValue={f.situacao} className={sel}>
                <option value="todas">Todas</option><option value="nunca">Nunca fiz</option><option value="errei">Errei na última vez</option><option value="acertei">Acertei na última vez</option></select></label>
          {f.area && <input type="hidden" name="area" value={f.area} />}{f.disciplina && <input type="hidden" name="disciplina" value={f.disciplina} />}
          {f.topico && <input type="hidden" name="topico" value={f.topico} />}
          <div className="flex flex-wrap gap-2">
            <button className="rounded-xl bg-brand px-5 py-2 font-medium text-black">Buscar</button>
            {filtrado && <Link href="/banco/questoes" className={btn}>Limpar</Link>}
          </div>
        </form>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 className="mr-auto text-lg font-medium">{total} {total === 1 ? 'questão' : 'questões'}</h2>
          {total > 0 && <Link href={praticar} className="rounded-xl bg-brand px-5 py-2 font-medium text-black">Praticar {total === 1 ? 'esta' : `estas ${total}`} →</Link>}
        </div>


        <section className="space-y-3">
          {!total && <p className="rounded-2xl border border-dashed border-line p-6 text-center text-muted">Nenhuma questão com esses filtros.{f.banca && <> Faltou uma prova? <Link href={`/contato?${new URLSearchParams({ pedir: 'prova', banca: f.banca, ...(f.anoDe && f.anoDe === f.anoAte ? { ano: String(f.anoDe) } : {}) })}#pedir-prova`} className="text-brand underline">Peça a prova</Link>.</>}</p>}
          <ul className="space-y-2">{linhas.map(q => (
              <li key={q.id} className="flex gap-3 rounded-xl border border-line bg-surface p-3 text-sm">
                <details className="min-w-0 flex-1">
                  <summary className="cursor-pointer list-none space-y-1">
                    <span className="flex flex-wrap gap-x-2 text-xs text-muted">
                      <span className="font-medium text-inherit">{[q.banca, q.ano].filter(Boolean).join(' ') || 'Sem banca'}</span>
                      <span>· {q.assunto ?? 'sem assunto'}</span>
                      <span className={q.vezes === 0 ? '' : q.ultimo_certo ? 'text-brand' : 'text-danger'}>· {q.vezes === 0 ? 'nunca feita' : q.ultimo_certo ? `acertou (${q.acertos}/${q.vezes})` : `errou na última (${q.acertos}/${q.vezes})`}</span>
                      {q.anulada ? <span className="text-warn">· anulada</span> : !q.gabarito && <span className="text-warn">· sem gabarito</span>}
                      {q.blocos.some(b => b.tipo === 'imagem') && <span>· com figura</span>}
                    </span>
                    <span className="block">{soTexto(q.blocos).slice(0, 220)}{soTexto(q.blocos).length > 220 ? '…' : ''}</span>
                  </summary>
                  <div className="mt-3 space-y-2 border-t border-line pt-3">
                    {q.blocos.map((b, k) => b.tipo === 'texto' ? <p key={k} className="whitespace-pre-line">{b.texto}</p> : (urlDe.get(b.caminho)
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <a key={k} href={urlDe.get(b.caminho)} target="_blank" rel="noreferrer" className="block"><img src={urlDe.get(b.caminho)} alt={`Figura da questão`} loading="lazy" className="max-h-[28rem] max-w-full rounded-lg border border-line bg-white" /></a>
                      : <p key={k} className="text-xs text-muted">[figura indisponível]</p>))}
                    <ul className="space-y-1">{q.alternativas.map(a => <li key={a.letra}><b>{a.letra})</b> {a.texto}</li>)}</ul>
                    <details className="text-muted"><summary className="cursor-pointer">Ver gabarito</summary>
                      <p className="mt-1">{ehLetra(q.gabarito) ? <>Gabarito: <b className="text-brand">{q.gabarito}</b>{q.gabarito_origem === 'ia' && <span className="text-warn"> (sugerido pela IA, conferir)</span>}</> : 'Sem gabarito.'}</p>
                      {q.comentario && <p className="mt-1 whitespace-pre-line">{q.comentario}</p>}
                      {expl.get(q.id)?.explicacao && <div className="mt-2"><ExplicacaoDaQuestao id={q.id} texto={expl.get(q.id)?.explicacao ?? null} origem={expl.get(q.id)?.explicacao_origem ?? null} /></div>}</details>
                    <div className="flex flex-wrap items-center gap-4">
                      {admin && <Link href={`/admin/questoes/${q.id}`} className="text-sm text-brand hover:underline">Editar na Administração</Link>}
                      <form action={excluirDoBanco}><input type="hidden" name="id" value={q.id} /><button className="text-sm text-danger hover:underline">Excluir do seu banco</button></form>
                    </div>
                  </div>
                </details>
              </li>))}</ul>
          {!!removidas && <form action={restaurarDoBancoGeral} className="flex flex-wrap items-center gap-2 text-sm">
            <input type="hidden" name="volta" value={volta} />
            <span className="flex-1 text-muted">Você excluiu {removidas} {removidas === 1 ? 'questão' : 'questões'} do banco geral; {removidas === 1 ? 'ela não volta sozinha' : 'elas não voltam sozinhas'}.</span>
            <button className="rounded-lg border border-line px-3 py-1.5 hover:border-brand">Trazer de volta</button>
          </form>}
          {paginas > 1 && <nav className="flex items-center gap-2 text-sm" aria-label="Páginas">
            {pagina > 1 && <Link href={url({ p: pagina - 1 })} className="rounded-lg border border-line px-3 py-1.5">‹ Anterior</Link>}
            <span className="text-muted">Página {pagina} de {paginas}</span>
            {pagina < paginas && <Link href={url({ p: pagina + 1 })} className="rounded-lg border border-line px-3 py-1.5">Próxima ›</Link>}
          </nav>}
        </section>
      </>}
    </div>)
}
