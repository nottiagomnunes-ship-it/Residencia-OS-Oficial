import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import { montarLista, excluirDoBanco } from '@/lib/banco'
import { lerFiltros, filtrosParaUrl, type Filtros } from '@/lib/engine/banco'
import { textoDosBlocos, ehLetra, type Bloco } from '@/lib/engine/provas'
import { AREAS, ROTULO_AREA, SIGLA_AREA, lerArea } from '@/lib/engine/areas'
import { pct } from '@/lib/engine/desempenho'
import { fmtData, inputCls } from '@/components/ui'
import AvisoDaUrl from '@/components/AvisoDaUrl'

const POR_PAGINA = 30
type Linha = { id: string; blocos: Bloco[]; alternativas: { letra: string; texto: string }[]; gabarito: string | null; gabarito_origem: string | null; anulada: boolean
  comentario: string | null; area: string | null; discipline_id: string | null; assunto: string | null; banca: string | null; ano: number | null; vezes: number; acertos: number; ultimo_certo: boolean | null }

export default async function Banco({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams, f = lerFiltros(sp), pagina = Math.max(1, Number(sp.p) || 1)
  const sb = await supabaseServer()
  const aplicar = <T,>(q: T): T => {
    let x = q as any
    if (f.area) x = x.eq('area', f.area)
    if (f.disciplina) x = x.eq('discipline_id', f.disciplina)
    if (f.assunto) x = x.eq('assunto', f.assunto)
    if (f.banca) x = x.eq('banca', f.banca)
    if (f.situacao === 'nunca') x = x.eq('vezes', 0)
    if (f.situacao === 'errei') x = x.eq('ultimo_certo', false)
    if (f.situacao === 'acertei') x = x.eq('ultimo_certo', true)
    return x as T
  }
  const [{ data: todas, error }, { data: lista, count }, { data: ds }, { data: listas }] = await Promise.all([
    sb.from('banco_questoes').select('discipline_id,assunto,banca,vezes,acertos,gabarito,anulada').limit(20000),
    aplicar(sb.from('banco_questoes').select('id,blocos,alternativas,gabarito,gabarito_origem,anulada,comentario,area,discipline_id,assunto,banca,ano,vezes,acertos,ultimo_certo', { count: 'exact' }))
      .order('criada_em', { ascending: false }).range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1),
    sb.from('disciplines').select('id,nome').order('ordem'),
    sb.from('provas').select('id,nome,criada_em,prova_tentativas(id,status,total,acertos)').eq('tipo', 'lista').order('criada_em', { ascending: false }).limit(8),
  ])
  const nomeDisc = new Map((ds ?? []).map(d => [d.id as string, d.nome as string]))
  if (error) return (
    <div className="space-y-4"><h1 className="text-2xl font-semibold">Banco de questões</h1>
      <p className="rounded-2xl border border-warn/40 bg-warn/10 p-4 text-sm text-warn">Para usar o banco de questões, rode <code>supabase/migrations/0034_banco_questoes.sql</code> no SQL Editor do Supabase (depois da 0028) e recarregue a página.</p></div>)
  const T = todas ?? [], feitas = T.filter(q => q.vezes > 0), acertosTot = T.reduce((s, q) => s + q.acertos, 0), vezesTot = T.reduce((s, q) => s + q.vezes, 0)
  const disponiveis = T.filter(q => q.gabarito && !q.anulada).length
  const discsComQuestao = [...new Set(T.map(q => q.discipline_id).filter(Boolean))] as string[]
  const assuntos = [...new Set(T.filter(q => !f.disciplina || q.discipline_id === f.disciplina).map(q => q.assunto).filter(Boolean))].sort() as string[]
  const bancas = [...new Set(T.map(q => q.banca).filter(Boolean))].sort() as string[]
  const linhas = (lista ?? []) as Linha[], total = count ?? 0, paginas = Math.max(1, Math.ceil(total / POR_PAGINA))
  const url = (o: Partial<Filtros> & { p?: number }) => { const q = filtrosParaUrl({ ...f, ...o }); const p = o.p && o.p > 1 ? `p=${o.p}` : ''; return `/banco?${[q, p].filter(Boolean).join('&')}` }
  const card = (l: string, v: string) => <div className="rounded-2xl border border-line bg-surface p-4"><p className="text-sm text-muted">{l}</p><p className="mt-1 text-2xl font-semibold">{v}</p></div>
  const sel = inputCls + ' w-full'
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Banco de questões</h1>
        <Link href="/banco/importar" className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-black">Importar questões</Link>
      </div>
      {sp.erro && <AvisoDaUrl tipo="erro" chaves={['erro']}>{sp.erro}</AvisoDaUrl>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {card('Questões no banco', String(T.length))}{card('Já feitas', String(feitas.length))}
        {card('Acerto', vezesTot ? `${pct(acertosTot, vezesTot)}%` : '—')}{card('Com gabarito', String(disponiveis))}
      </div>

      {T.length === 0
        ? <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">O banco está vazio. Importe um PDF ou .docx de questões (com o gabarito no fim) ou um pacote .json para começar.</p>
        : <>
        <form className="grid gap-3 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-2 lg:grid-cols-6" action={montarLista}>
          <h2 className="font-medium sm:col-span-2 lg:col-span-6">Filtrar e montar uma lista</h2>
          <label className="text-sm text-muted">Área<select name="area" defaultValue={f.area ?? ''} className={sel}><option value="">Todas</option>{AREAS.map(a => <option key={a} value={a}>{ROTULO_AREA[a]}</option>)}</select></label>
          <label className="text-sm text-muted">Disciplina<select name="disciplina" defaultValue={f.disciplina ?? ''} className={sel}><option value="">Todas</option>{discsComQuestao.map(d => <option key={d} value={d}>{nomeDisc.get(d) ?? 'Disciplina'}</option>)}</select></label>
          <label className="text-sm text-muted">Assunto<select name="assunto" defaultValue={f.assunto ?? ''} className={sel}><option value="">Todos</option>{assuntos.map(a => <option key={a} value={a}>{a}</option>)}</select></label>
          <label className="text-sm text-muted">Banca<select name="banca" defaultValue={f.banca ?? ''} className={sel}><option value="">Todas</option>{bancas.map(b => <option key={b} value={b}>{b}</option>)}</select></label>
          <label className="text-sm text-muted">Situação<select name="situacao" defaultValue={f.situacao} className={sel}>
            <option value="todas">Todas</option><option value="nunca">Nunca fiz</option><option value="errei">Errei na última vez</option><option value="acertei">Acertei na última vez</option></select></label>
          <label className="text-sm text-muted">Quantas<select name="quantidade" defaultValue="10" className={sel}>{[5, 10, 20, 30, 50].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
          <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-6">
            <button className="rounded-xl bg-brand px-5 py-2.5 font-medium text-black">Montar lista e começar</button>
            <button formAction="/banco" formMethod="get" className="rounded-xl border border-line px-4 py-2.5 text-sm hover:border-brand">Só filtrar a lista abaixo</button>
          </div>
          <p className="text-xs text-muted sm:col-span-2 lg:col-span-6">As questões são sorteadas entre as que batem com os filtros (só as com gabarito). A lista abre na mesma tela das provas; ao entregar, os erros vão para o Caderno de Erros e o resultado para o Desempenho.</p>
        </form>

        {(listas ?? []).length > 0 && <section className="space-y-2">
          <h2 className="font-medium">Listas recentes</h2>
          <ul className="grid gap-2 md:grid-cols-2">{(listas ?? []).map((l: any) => { const t = (l.prova_tentativas ?? [])[0]; return (
            <li key={l.id}><Link href={t ? `/provas/tentativa/${t.id}` : `/provas/${l.id}`} className="flex flex-wrap justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm hover:border-brand">
              <span>{l.nome}</span><span className="text-muted">{t?.status === 'corrigida' ? `${t.acertos}/${t.total} (${pct(t.acertos ?? 0, t.total ?? 0)}%)` : t ? 'em andamento' : ''} · {fmtData(String(l.criada_em).slice(0, 10))}</span></Link></li>) })}</ul>
        </section>}

        <section className="space-y-3">
          <h2 className="font-medium">{total} {total === 1 ? 'questão' : 'questões'}{f.area || f.disciplina || f.assunto || f.banca || f.situacao !== 'todas' ? ' com esses filtros' : ''}</h2>
          <ul className="space-y-2">{linhas.map(q => {
            const lb = lerArea(q.area)
            return (
              <li key={q.id} className="rounded-xl border border-line bg-surface p-3 text-sm">
                <details>
                  <summary className="cursor-pointer list-none space-y-1">
                    <span className="flex flex-wrap gap-x-2 text-xs text-muted">
                      {q.banca && <span>{q.banca}{q.ano ? ` ${q.ano}` : ''}</span>}{lb && <span>· {SIGLA_AREA[lb]}</span>}
                      {q.discipline_id && <span>· {nomeDisc.get(q.discipline_id)}</span>}{q.assunto && <span>· {q.assunto}</span>}
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
