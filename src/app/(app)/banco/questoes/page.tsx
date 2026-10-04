import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import { excluirDoBanco, definirAssuntoEmLote, definirTemaEmLote, sugerirTemasPeloTexto, ligarAssunto, sugerirAssuntosDoBanco, publicarNoBancoGeral, retirarDoBancoGeral, restaurarDoBancoGeral } from '@/lib/banco'
import { aplicarFiltros, assuntoDoFiltro, sincronizarBancoGeral, ehAdmin, avisoDoBancoGeral, podeOrganizar, carregarTemas } from '@/lib/banco-data'
import { porEspecialidade } from '@/lib/engine/temas'
import OpcoesDeAssunto from '@/components/banco/OpcoesDeAssunto'
import { lerFiltros, filtrosParaUrl, SEM_ASSUNTO, assuntoParecido, type Filtros } from '@/lib/engine/banco'
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
  // primeiro o banco geral (questões novas e correções), para a lista já vir com elas
  const [sync, topico, admin, gestor] = await Promise.all([sincronizarBancoGeral(sb), assuntoDoFiltro(sb, f), ehAdmin(sb), podeOrganizar(sb)])
  // gestor: importa e organiza (a conta administradora). O estudante só busca, pratica e exclui o que não quer.
  const org = gestor && sp.org === '1' // modo Organizar (assuntos, lote, banco geral)
  const aviso = avisoDoBancoGeral(sync), daPagina = <T,>(q: T) => (aplicarFiltros(q, f, topico) as any).order('ano', { ascending: false, nullsFirst: false }).order('criada_em', { ascending: false }).range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1)
  // separadas: sem a 0037, estas falham e a página segue sem as marcas do banco geral
  const [{ data: todas, error }, { data: lista, count }, { data: ds }, { data: ts }, { data: geralDaPagina }, { count: removidas }, { data: colecoes }, temas, { data: comTema }] = await Promise.all([
    sb.from('banco_questoes').select('id,discipline_id,topic_id,assunto,banca,ano').limit(20000),
    aplicarFiltros(sb.from('banco_questoes').select('id,blocos,alternativas,gabarito,gabarito_origem,anulada,comentario,area,discipline_id,topic_id,assunto,banca,ano,vezes,acertos,ultimo_certo', { count: 'exact' }), f, topico)
      .order('ano', { ascending: false, nullsFirst: false }).order('criada_em', { ascending: false }).range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1),
    sb.from('disciplines').select('id,nome').order('ordem'),
    sb.from('topics').select('id,nome,discipline_id').limit(5000),
    daPagina(sb.from('banco_questoes').select('id,origem_geral')),
    sync ? sb.from('banco_geral_removidas').select('geral_id', { count: 'exact', head: true }) : Promise.resolve({ count: 0 }),
    admin ? sb.from('banco_geral').select('colecao').not('colecao', 'is', null).limit(5000) : Promise.resolve({ data: [] }),
    carregarTemas(sb), // separada: sem a 0040, a lista vem vazia e a página segue com os assuntos
    sb.from('banco_questoes').select('id,tema_id').not('tema_id', 'is', null).limit(20000),
  ])
  if (error) return (
    <div className="space-y-4"><h1 className="text-2xl font-semibold">Banco de questões</h1>
      <p className="rounded-2xl border border-warn/40 bg-warn/10 p-4 text-sm text-warn">Para usar o banco de questões, rode <code>supabase/migrations/0034_banco_questoes.sql</code> no SQL Editor do Supabase (depois da 0028) e recarregue a página.</p></div>)
  const temaDe = new Map(((comTema ?? []) as { id: string; tema_id: string }[]).map(q => [q.id, q.tema_id]))
  const T = (todas ?? []).map(q => ({ ...q, tema_id: temaDe.get(q.id) ?? null })), discs = (ds ?? []) as { id: string; nome: string }[], topicos = (ts ?? []) as TopicoSimples[]
  const nomeDisc = new Map(discs.map(d => [d.id, d.nome]))
  const discsComQuestao = [...new Set(T.map(q => q.discipline_id).filter(Boolean))] as string[]
  /** Valores de um campo com quantas questões têm cada um (para os seletores: "UFMA (120)"). */
  const contar = (xs: (string | null)[]) => { const m = new Map<string, number>(); for (const x of xs) if (x) m.set(x, (m.get(x) ?? 0) + 1); return m }
  const assuntos = [...contar(T.filter(q => !f.disciplina || q.discipline_id === f.disciplina).map(q => q.assunto))].sort((a, b) => a[0].localeCompare(b[0]))
  const bancas = [...contar(T.map(q => q.banca))].sort((a, b) => a[0].localeCompare(b[0]))
  const anos = [...new Set(T.map(q => q.ano).filter((a): a is number => !!a))].sort((a, b) => b - a)
  const semAssunto = T.filter(q => !q.assunto).length
  // "Ligar assuntos": nomes de assunto que não estão ligados a Matérias (ex.: vieram do banco geral com um nome diferente do seu)
  const porNome = new Map<string, { n: number; discs: Map<string, number> }>()
  for (const q of T) if (q.assunto && !q.topic_id) {
    const g = porNome.get(q.assunto) ?? { n: 0, discs: new Map() }; g.n++
    if (q.discipline_id) g.discs.set(q.discipline_id, (g.discs.get(q.discipline_id) ?? 0) + 1)
    porNome.set(q.assunto, g)
  }
  const soltos = [...porNome].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0])).map(([nome, g]) => {
    const disc = [...g.discs].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    const sugerido = assuntoParecido(nome, topicos, disc)
    return { nome, n: g.n, disc, padrao: sugerido ? `t:${sugerido.id}` : disc ? `criar:${disc}` : '' }
  })
  const doGeral = new Set(((geralDaPagina ?? []) as { id: string; origem_geral: string | null }[]).filter(q => q.origem_geral).map(q => q.id))
  const nomesColecoes = [...new Set(((colecoes ?? []) as { colecao: string }[]).map(c => c.colecao))].sort()
  const linhas = (lista ?? []) as Linha[], total = count ?? 0, paginas = Math.max(1, Math.ceil(total / POR_PAGINA))
  const url = (o: Partial<Filtros> & { p?: number; org?: boolean }) => {
    const qs = [filtrosParaUrl({ ...f, ...o }), o.p && o.p > 1 ? `p=${o.p}` : '', (o.org ?? org) ? 'org=1' : ''].filter(Boolean).join('&')
    return qs ? `/banco/questoes?${qs}` : '/banco/questoes'
  }
  const volta = url({ p: pagina }), filtrado = !!(f.area || f.disciplina || f.assunto || f.topico || f.banca || f.anoDe || f.anoAte || f.situacao !== 'todas')
  const maisFiltros = !!(f.area || f.disciplina || f.situacao !== 'todas'), praticar = `/banco/praticar${filtrosParaUrl(f) ? `?${filtrosParaUrl(f)}` : ''}`
  const gruposTopicos = discs.filter(d => topicos.some(t => t.discipline_id === d.id))
  const sel = inputCls + ' w-full', btn = 'rounded-xl border border-line px-4 py-2 text-sm hover:border-brand'
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">Banco de questões</h1><p className="text-sm text-muted">Procure questões por banca, assunto e ano.</p></div>
        {gestor && <Link href="/banco/importar" className="rounded-xl border border-line px-4 py-2 text-sm hover:border-brand">Importar questões</Link>}
      </div>
      {sp.ok && <AvisoDaUrl tipo="ok" chaves={['ok']}>{sp.ok}</AvisoDaUrl>}
      {sp.erro && <AvisoDaUrl tipo="erro" chaves={['erro']}>{sp.erro}</AvisoDaUrl>}
      {aviso && <p role="status" className="rounded-xl border border-brand/40 bg-brand/10 p-3 text-sm">{aviso}</p>}

      {T.length === 0
        ? <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">{gestor ? 'O banco está vazio. Importe um PDF ou .docx de questões (com o gabarito no fim) ou um pacote .json para começar.' : 'Ainda não há questões no banco. Elas aparecem aqui assim que forem publicadas.'}</p>
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
          <details open={maisFiltros} className="text-sm">
            <summary className="cursor-pointer text-muted">Mais filtros{maisFiltros ? ' (em uso)' : ''}</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="text-muted">Área<select name="area" defaultValue={f.area ?? ''} className={sel}><option value="">Todas</option>{AREAS.map(a => <option key={a} value={a}>{ROTULO_AREA[a]}</option>)}</select></label>
              <label className="text-muted">Disciplina<select name="disciplina" defaultValue={f.disciplina ?? ''} className={sel}><option value="">Todas</option>{discsComQuestao.map(d => <option key={d} value={d}>{nomeDisc.get(d) ?? 'Disciplina'}</option>)}</select></label>
              <label className="text-muted">Situação<select name="situacao" defaultValue={f.situacao} className={sel}>
                <option value="todas">Todas</option><option value="nunca">Nunca fiz</option><option value="errei">Errei na última vez</option><option value="acertei">Acertei na última vez</option></select></label>
            </div>
          </details>
          {f.topico && <input type="hidden" name="topico" value={f.topico} />}
          {org && <input type="hidden" name="org" value="1" />}
          <div className="flex flex-wrap gap-2">
            <button className="rounded-xl bg-brand px-5 py-2 font-medium text-black">Buscar</button>
            {filtrado && <Link href={org ? '/banco/questoes?org=1' : '/banco/questoes'} className={btn}>Limpar</Link>}
          </div>
        </form>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 className="mr-auto text-lg font-medium">{total} {total === 1 ? 'questão' : 'questões'}</h2>
          {gestor && <Link href={url({ p: 1, org: !org })} aria-pressed={org} className={`text-sm ${org ? 'text-brand' : 'text-muted hover:text-brand'}`}>
            {org ? '✓ Organizando' : 'Organizar'}{!org && (soltos.length > 0 || semAssunto > 0) ? ' (assuntos pendentes)' : ''}</Link>}
          {total > 0 && <Link href={praticar} className="rounded-xl bg-brand px-5 py-2 font-medium text-black">Praticar {total === 1 ? 'esta' : `estas ${total}`} →</Link>}
        </div>

        {org && <>
        {soltos.length > 0 && <section className="space-y-3 rounded-2xl border border-line bg-surface p-5 text-sm">
          <h2 className="font-medium">Ligar assuntos</h2>
          <p className="text-muted">Estes nomes de assunto ainda não estão ligados a um assunto seu de Matérias, então não contam no Desempenho por assunto. Ligue cada um uma vez: todas as questões com aquele nome vão juntas. Já deixei escolhido o de nome mais parecido; confira antes.</p>
          <ul className="divide-y divide-line">{soltos.slice(0, 25).map(r => (
            <li key={r.nome}><form action={ligarAssunto} className="flex flex-wrap items-center gap-2 py-2">
              <input type="hidden" name="volta" value={volta} /><input type="hidden" name="rotulo" value={r.nome} />
              <span className="min-w-40 flex-1"><b className="font-medium">{r.nome}</b> <span className="text-muted">· {r.n} {r.n === 1 ? 'questão' : 'questões'}</span></span>
              <select name="alvo" defaultValue={r.padrao} aria-label={`Ligar "${r.nome}" a`} className={inputCls + ' min-w-0 flex-1'}>
                <option value="">Escolha o assunto de Matérias…</option>
                {gruposTopicos.map(d => <optgroup key={d.id} label={d.nome}>{topicos.filter(t => t.discipline_id === d.id).sort((a, b) => a.nome.localeCompare(b.nome)).map(t => <option key={t.id} value={`t:${t.id}`}>{t.nome}</option>)}</optgroup>)}
                {discs.length > 0 && <optgroup label={`Criar "${r.nome.slice(0, 40)}" em Matérias`}>{discs.map(d => <option key={d.id} value={`criar:${d.id}`}>Criar em {d.nome}</option>)}</optgroup>}
              </select>
              <button className="rounded-lg border border-line px-3 py-1.5 hover:border-brand">Ligar</button>
            </form></li>))}</ul>
          {soltos.length > 25 && <p className="text-xs text-muted">E mais {soltos.length - 25}: aparecem aqui à medida que você liga estes.</p>}
        </section>}

        <section className="space-y-3 rounded-2xl border border-line bg-surface p-5 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium">{admin ? 'Tema e assunto das questões' : 'Assunto das questões'}</h2>
            {semAssunto ? <Link href={`/banco/questoes?assunto=${encodeURIComponent(SEM_ASSUNTO)}`} className="text-muted hover:text-brand">{semAssunto} {semAssunto === 1 ? 'questão' : 'questões'} sem assunto</Link>
              : <span className="text-muted">Todas têm assunto</span>}
          </div>
          <p className="text-muted">Marque as questões na lista abaixo (ou todas as dos filtros) e escolha o que fazer com elas.</p>
          {semAssunto > 0 && <form action={sugerirAssuntosDoBanco} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="volta" value={volta} />
            <button className="rounded-lg border border-line px-3 py-1.5 hover:border-brand">Sugerir assunto de Matérias pelo texto</button>
            <span className="text-xs text-muted">{topicos.length ? 'Procura o nome dos seus assuntos de Matérias no texto das questões sem assunto (da mesma disciplina) e liga quando acha.' : 'Cadastre os assuntos em Matérias → Assuntos para usar a sugestão.'}</span>
          </form>}
          <form id="lote" action={definirAssuntoEmLote} className="space-y-3 border-t border-line pt-3">
            <input type="hidden" name="filtros" value={filtrosParaUrl(f)} />
            <input type="hidden" name="volta" value={volta} />
            {admin && <div className="space-y-2">
              <h3 className="font-medium">Tema (lista geral) <span className="font-normal text-muted">· é o que as outras contas usam para buscar e praticar</span></h3>
              {temas.length ? <div className="flex flex-wrap items-end gap-2">
                <label className="min-w-56 flex-1 text-muted">Tema<select name="tema" defaultValue="" className={sel}>
                  <option value="">Escolha o tema…</option>
                  {porEspecialidade(temas).map(([e, l]) => <optgroup key={e} label={e}>{l.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}</optgroup>)}
                  <option value="nenhum">Sem tema (tirar)</option>
                </select></label>
                <button formAction={definirTemaEmLote} className="rounded-xl bg-brand px-4 py-2 font-medium text-black">Dar o tema às marcadas</button>
                <button formAction={sugerirTemasPeloTexto} className="rounded-xl border border-line px-4 py-2 hover:border-brand">Sugerir tema pelo texto</button>
              </div> : <p className="text-muted">A lista de temas está vazia.</p>}
              <p className="text-xs text-muted">"Sugerir tema pelo texto" age nas marcadas (ou, sem nenhuma marcada, em todas as questões sem tema) e procura o nome dos temas no enunciado. <Link href="/banco/temas" className="text-brand hover:underline">Lista de temas ({temas.length}) →</Link></p>
              <p className="text-xs text-muted">Classificar fora do app: <a href={`/banco/exportar${filtrosParaUrl(f) ? `?${filtrosParaUrl(f)}` : ''}`} className="text-brand hover:underline">exportar estas {total} questões (.json)</a>, mandar o arquivo para o Claude e importar de volta o arquivo com os temas (Importar questões). As que já estão no banco não se repetem: só recebem o tema.</p>
            </div>}
            <details open={!admin} className={admin ? 'border-t border-line pt-3' : ''}>
              <summary className="cursor-pointer font-medium">Assunto das suas Matérias{admin ? <span className="font-normal text-muted"> · só para o seu Desempenho</span> : ''}</summary>
              <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                <label className="text-muted">Dar às marcadas o assunto<select name="alvo" defaultValue="" className={sel}>
                  <option value="">Escolha… (ou escreva ao lado)</option>
                  {gruposTopicos.map(d => <optgroup key={d.id} label={d.nome}>{topicos.filter(t => t.discipline_id === d.id).sort((a, b) => a.nome.localeCompare(b.nome)).map(t => <option key={t.id} value={`t:${t.id}`}>{t.nome}</option>)}</optgroup>)}
                  <option value="nenhum">Sem assunto (tirar)</option>
                </select></label>
                <label className="text-muted">ou um nome novo<input name="texto" maxLength={120} placeholder="Ex.: Bloqueio de neuroeixo" className={sel} />
                  {discs.length > 0 && <select name="criar_em" defaultValue={f.disciplina ?? ''} aria-label="Criar em Matérias" className={sel + ' mt-1'}>
                    <option value="">Só o nome (não criar em Matérias)</option>{discs.map(d => <option key={d.id} value={d.id}>Criar em Matérias: {d.nome}</option>)}</select>}</label>
                <button className="rounded-xl border border-line px-4 py-2 hover:border-brand">Salvar nas marcadas</button>
              </div>
            </details>
            {admin && <div className="space-y-2 border-t border-line pt-3">
              <h3 className="font-medium">Banco geral <span className="font-normal text-muted">(só a conta administradora vê isto)</span></h3>
              <p className="text-xs text-muted">Publicar manda para todas as contas o enunciado, as figuras, as alternativas, o gabarito (a letra), a disciplina e o assunto. O comentário <b>não</b> vai: fica só no seu banco. Publicar de novo uma questão atualiza a cópia das outras contas (sem mexer no histórico nem no assunto delas).</p>
              <div className="flex flex-wrap items-end gap-2">
                <label className="min-w-48 flex-1 text-muted">Coleção (opcional)<input name="colecao" list="colecoes" maxLength={120} placeholder="Ex.: Anestesiologia – UFMA" className={sel} /></label>
                <datalist id="colecoes">{nomesColecoes.map(c => <option key={c} value={c} />)}</datalist>
                <button formAction={publicarNoBancoGeral} className="rounded-xl border border-brand px-4 py-2 text-brand">Publicar as marcadas</button>
                <button formAction={retirarDoBancoGeral} className="rounded-xl px-3 py-2 text-danger hover:underline">Tirar as marcadas do banco geral</button>
              </div>
            </div>}
          </form>
        </section>
        </>}

        <section className="space-y-3">
          {org && linhas.length > 0 && <MarcarTodas form="lote" total={total} naPagina={linhas.length} />}
          {!total && <p className="rounded-2xl border border-dashed border-line p-6 text-center text-muted">Nenhuma questão com esses filtros.</p>}
          <ul className="space-y-2">{linhas.map(q => {
            const lb = lerArea(q.area)
            return (
              <li key={q.id} className="flex gap-3 rounded-xl border border-line bg-surface p-3 text-sm">
                {org && <input type="checkbox" name="sel" value={q.id} form="lote" aria-label="Marcar esta questão" className="mt-1 size-4 shrink-0 accent-brand" />}
                <details className="min-w-0 flex-1">
                  <summary className="cursor-pointer list-none space-y-1">
                    <span className="flex flex-wrap gap-x-2 text-xs text-muted">
                      <span className="font-medium text-inherit">{[q.banca, q.ano].filter(Boolean).join(' ') || 'Sem banca'}</span>
                      <span>· {q.assunto ?? 'sem assunto'}</span>{org && lb && <span>· {SIGLA_AREA[lb]}</span>}{org && doGeral.has(q.id) && <span className="text-info">· banco geral</span>}
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
                    {gestor && <AssuntoDaQuestao id={q.id} topicId={q.topic_id} assunto={q.assunto} disciplinaId={q.discipline_id} assuntos={topicos} disciplinas={discs} />}
                    <form action={excluirDoBanco}><input type="hidden" name="id" value={q.id} /><button className="text-sm text-danger hover:underline">Excluir do banco</button></form>
                  </div>
                </details>
              </li>)
          })}</ul>
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
