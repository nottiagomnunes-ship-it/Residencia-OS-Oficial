import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import { excluirDoBanco, definirAssuntoEmLote, sugerirAssuntosDoBanco } from '@/lib/banco'
import { aplicarFiltros, assuntoDoFiltro } from '@/lib/banco-data'
import { lerFiltros, filtrosParaUrl, SEM_ASSUNTO, type Filtros } from '@/lib/engine/banco'
import { textoDosBlocos, ehLetra, type Bloco } from '@/lib/engine/provas'
import { AREAS, ROTULO_AREA, SIGLA_AREA, lerArea } from '@/lib/engine/areas'
import { inputCls } from '@/components/ui'
import AvisoDaUrl from '@/components/AvisoDaUrl'
import AssuntoDaQuestao, { type TopicoSimples } from '@/components/banco/AssuntoDaQuestao'
import MarcarTodas from '@/components/banco/MarcarTodas'

const POR_PAGINA = 30
type Linha = { id: string; blocos: Bloco[]; alternativas: { letra: string; texto: string }[]; gabarito: string | null; gabarito_origem: string | null; anulada: boolean
  comentario: string | null; area: string | null; discipline_id: string | null; topic_id: string | null; assunto: string | null; banca: string | null; ano: number | null
  vezes: number; acertos: number; ultimo_certo: boolean | null }

/** Banco: organizar as questões (ver, filtrar, dar assunto, excluir, importar). Estudar fica em Praticar (/banco). */
export default async function BancoDeQuestoes({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams, f = lerFiltros(sp), pagina = Math.max(1, Number(sp.p) || 1)
  const sb = await supabaseServer()
  const topico = await assuntoDoFiltro(sb, f)
  const [{ data: todas, error }, { data: lista, count }, { data: ds }, { data: ts }] = await Promise.all([
    sb.from('banco_questoes').select('discipline_id,assunto,banca').limit(20000),
    aplicarFiltros(sb.from('banco_questoes').select('id,blocos,alternativas,gabarito,gabarito_origem,anulada,comentario,area,discipline_id,topic_id,assunto,banca,ano,vezes,acertos,ultimo_certo', { count: 'exact' }), f, topico)
      .order('criada_em', { ascending: false }).range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1),
    sb.from('disciplines').select('id,nome').order('ordem'),
    sb.from('topics').select('id,nome,discipline_id').limit(5000),
  ])
  if (error) return (
    <div className="space-y-4"><h1 className="text-2xl font-semibold">Banco de questões</h1>
      <p className="rounded-2xl border border-warn/40 bg-warn/10 p-4 text-sm text-warn">Para usar o banco de questões, rode <code>supabase/migrations/0034_banco_questoes.sql</code> no SQL Editor do Supabase (depois da 0028) e recarregue a página.</p></div>)
  const T = todas ?? [], discs = (ds ?? []) as { id: string; nome: string }[], topicos = (ts ?? []) as TopicoSimples[]
  const nomeDisc = new Map(discs.map(d => [d.id, d.nome]))
  const discsComQuestao = [...new Set(T.map(q => q.discipline_id).filter(Boolean))] as string[]
  const assuntos = [...new Set(T.filter(q => !f.disciplina || q.discipline_id === f.disciplina).map(q => q.assunto).filter(Boolean))].sort() as string[]
  const bancas = [...new Set(T.map(q => q.banca).filter(Boolean))].sort() as string[]
  const semAssunto = T.filter(q => !q.assunto).length
  const linhas = (lista ?? []) as Linha[], total = count ?? 0, paginas = Math.max(1, Math.ceil(total / POR_PAGINA))
  const url = (o: Partial<Filtros> & { p?: number }) => {
    const qs = [filtrosParaUrl({ ...f, ...o }), o.p && o.p > 1 ? `p=${o.p}` : ''].filter(Boolean).join('&')
    return qs ? `/banco/questoes?${qs}` : '/banco/questoes'
  }
  const volta = url({ p: pagina }), filtrado = !!(f.area || f.disciplina || f.assunto || f.topico || f.banca || f.situacao !== 'todas')
  const gruposTopicos = discs.filter(d => topicos.some(t => t.discipline_id === d.id))
  const sel = inputCls + ' w-full', btn = 'rounded-xl border border-line px-4 py-2 text-sm hover:border-brand'
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">Banco de questões</h1><p className="text-sm text-muted">Todas as suas questões: importe, confira, dê o assunto e exclua. Para estudar, use Praticar.</p></div>
        <Link href="/banco/importar" className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-black">Importar questões</Link>
      </div>
      {sp.ok && <AvisoDaUrl tipo="ok" chaves={['ok']}>{sp.ok}</AvisoDaUrl>}
      {sp.erro && <AvisoDaUrl tipo="erro" chaves={['erro']}>{sp.erro}</AvisoDaUrl>}

      {T.length === 0
        ? <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">O banco está vazio. Importe um PDF ou .docx de questões (com o gabarito no fim) ou um pacote .json para começar.</p>
        : <>
        <form action="/banco/questoes" method="get" className="grid gap-3 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm text-muted">Área<select name="area" defaultValue={f.area ?? ''} className={sel}><option value="">Todas</option>{AREAS.map(a => <option key={a} value={a}>{ROTULO_AREA[a]}</option>)}</select></label>
          <label className="text-sm text-muted">Disciplina<select name="disciplina" defaultValue={f.disciplina ?? ''} className={sel}><option value="">Todas</option>{discsComQuestao.map(d => <option key={d} value={d}>{nomeDisc.get(d) ?? 'Disciplina'}</option>)}</select></label>
          <label className="text-sm text-muted">Assunto<select name="assunto" defaultValue={f.assunto ?? ''} className={sel}><option value="">Todos</option>
            {semAssunto > 0 && <option value={SEM_ASSUNTO}>Sem assunto ({semAssunto})</option>}{assuntos.map(a => <option key={a} value={a}>{a}</option>)}</select></label>
          <label className="text-sm text-muted">Banca<select name="banca" defaultValue={f.banca ?? ''} className={sel}><option value="">Todas</option>{bancas.map(b => <option key={b} value={b}>{b}</option>)}</select></label>
          <label className="text-sm text-muted">Situação<select name="situacao" defaultValue={f.situacao} className={sel}>
            <option value="todas">Todas</option><option value="nunca">Nunca fiz</option><option value="errei">Errei na última vez</option><option value="acertei">Acertei na última vez</option></select></label>
          {f.topico && <input type="hidden" name="topico" value={f.topico} />}
          <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-5">
            <button className="rounded-xl bg-brand px-5 py-2 font-medium text-black">Filtrar</button>
            {filtrado && <Link href="/banco/questoes" className={btn}>Limpar filtros</Link>}
            <Link href={`/banco/praticar${filtrosParaUrl(f) ? `?${filtrosParaUrl(f)}` : ''}`} className={btn}>Praticar estas</Link>
          </div>
        </form>

        <section className="space-y-3 rounded-2xl border border-line bg-surface p-5 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium">Assunto das questões</h2>
            {semAssunto ? <Link href={`/banco/questoes?assunto=${encodeURIComponent(SEM_ASSUNTO)}`} className="text-muted hover:text-brand">{semAssunto} {semAssunto === 1 ? 'questão' : 'questões'} sem assunto</Link>
              : <span className="text-muted">Todas têm assunto</span>}
          </div>
          <p className="text-muted">Abra uma questão para escolher o assunto dela, ou marque várias na lista abaixo e dê o mesmo assunto a todas. Ligado a um assunto de Matérias, o resultado entra no Desempenho daquele assunto.</p>
          {semAssunto > 0 && <form action={sugerirAssuntosDoBanco} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="volta" value={volta} />
            <button className="rounded-lg border border-line px-3 py-1.5 hover:border-brand">Sugerir pelo texto</button>
            <span className="text-xs text-muted">{topicos.length ? 'Procura o nome dos seus assuntos de Matérias no texto das questões sem assunto (da mesma disciplina) e liga quando acha.' : 'Cadastre os assuntos em Matérias → Assuntos para usar a sugestão.'}</span>
          </form>}
          <form id="lote" action={definirAssuntoEmLote} className="grid gap-2 border-t border-line pt-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <input type="hidden" name="volta" value={volta} />
            <label className="text-muted">Dar às marcadas o assunto<select name="alvo" defaultValue="" className={sel}>
              <option value="">Escolha… (ou escreva ao lado)</option>
              {gruposTopicos.map(d => <optgroup key={d.id} label={d.nome}>{topicos.filter(t => t.discipline_id === d.id).sort((a, b) => a.nome.localeCompare(b.nome)).map(t => <option key={t.id} value={`t:${t.id}`}>{t.nome}</option>)}</optgroup>)}
              <option value="nenhum">Sem assunto (tirar)</option>
            </select></label>
            <label className="text-muted">ou um nome novo<input name="texto" maxLength={120} placeholder="Ex.: Bloqueio de neuroeixo" className={sel} />
              {discs.length > 0 && <select name="criar_em" defaultValue={f.disciplina ?? ''} aria-label="Criar em Matérias" className={sel + ' mt-1'}>
                <option value="">Só o nome (não criar em Matérias)</option>{discs.map(d => <option key={d.id} value={d.id}>Criar em Matérias: {d.nome}</option>)}</select>}</label>
            <button className="rounded-xl bg-brand px-4 py-2 font-medium text-black">Salvar nas marcadas</button>
          </form>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-medium">{total} {total === 1 ? 'questão' : 'questões'}{filtrado ? ' com esses filtros' : ''}</h2>{linhas.length > 0 && <MarcarTodas form="lote" />}</div>
          <ul className="space-y-2">{linhas.map(q => {
            const lb = lerArea(q.area)
            return (
              <li key={q.id} className="flex gap-3 rounded-xl border border-line bg-surface p-3 text-sm">
                <input type="checkbox" name="sel" value={q.id} form="lote" aria-label="Marcar esta questão" className="mt-1 size-4 shrink-0 accent-brand" />
                <details className="min-w-0 flex-1">
                  <summary className="cursor-pointer list-none space-y-1">
                    <span className="flex flex-wrap gap-x-2 text-xs text-muted">
                      {q.banca && <span>{q.banca}{q.ano ? ` ${q.ano}` : ''}</span>}{lb && <span>· {SIGLA_AREA[lb]}</span>}
                      {q.discipline_id && <span>· {nomeDisc.get(q.discipline_id)}</span>}{q.assunto ? <span>· {q.assunto}</span> : <span className="text-warn">· sem assunto</span>}
                      <span className={q.vezes === 0 ? '' : q.ultimo_certo ? 'text-brand' : 'text-danger'}>· {q.vezes === 0 ? 'nunca feita' : q.ultimo_certo ? `acertou (${q.acertos}/${q.vezes})` : `errou na última (${q.acertos}/${q.vezes})`}</span>
                      {q.anulada ? <span className="text-warn">· anulada</span> : !q.gabarito && <span className="text-warn">· sem gabarito</span>}
                    </span>
                    <span className="block">{textoDosBlocos(q.blocos).slice(0, 220)}{textoDosBlocos(q.blocos).length > 220 ? '…' : ''}</span>
                  </summary>
                  <div className="mt-3 space-y-2 border-t border-line pt-3">
                    {q.blocos.map((b, k) => b.tipo === 'texto' ? <p key={k} className="whitespace-pre-line">{b.texto}</p> : <p key={k} className="text-xs text-muted">[figura: aparece ao fazer a questão]</p>)}
                    <ul className="space-y-1">{q.alternativas.map(a => <li key={a.letra}><b>{a.letra})</b> {a.texto}</li>)}</ul>
                    <details className="text-muted"><summary className="cursor-pointer">Ver gabarito</summary>
                      <p className="mt-1">{ehLetra(q.gabarito) ? <>Gabarito: <b className="text-brand">{q.gabarito}</b>{q.gabarito_origem === 'ia' && <span className="text-warn"> (sugerido pela IA, conferir)</span>}</> : 'Sem gabarito.'}</p>
                      {q.comentario && <p className="mt-1 whitespace-pre-line">{q.comentario}</p>}</details>
                    <AssuntoDaQuestao id={q.id} topicId={q.topic_id} assunto={q.assunto} disciplinaId={q.discipline_id} assuntos={topicos} disciplinas={discs} />
                    <form action={excluirDoBanco}><input type="hidden" name="id" value={q.id} /><button className="text-sm text-danger hover:underline">Excluir do banco</button></form>
                  </div>
                </details>
              </li>)
          })}</ul>
          {paginas > 1 && <nav className="flex items-center gap-2 text-sm" aria-label="Páginas">
            {pagina > 1 && <Link href={url({ p: pagina - 1 })} className="rounded-lg border border-line px-3 py-1.5">‹ Anterior</Link>}
            <span className="text-muted">Página {pagina} de {paginas}</span>
            {pagina < paginas && <Link href={url({ p: pagina + 1 })} className="rounded-lg border border-line px-3 py-1.5">Próxima ›</Link>}
          </nav>}
        </section>
      </>}
    </div>)
}
