'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'
import { lerDocx, tipoDaImagem, extensao, ArquivoInvalido } from '@/lib/engine/provas-docx'
import { paragrafosDoPdf, pareceTerFigura } from '@/lib/engine/provas-pdf'
import { montarQuestoes, lerGabarito, textoDosBlocos, faixas, type Bloco } from '@/lib/engine/provas'
import { lerPacote, itensDeQuestoes, type ItemLido } from '@/lib/engine/banco'
import { SIGLA_AREA, normalizar } from '@/lib/engine/areas'
import { porEspecialidade } from '@/lib/engine/temas'
import { lerPdfDeQuestoes, importarNoBanco } from '@/lib/banco'
import { inputCls } from '@/components/ui'
import { Enunciado } from '@/components/provas/Enunciado'
import type { BlocoNaTela } from '@/lib/provas-data'

type Lido = { itens: ItemLido[]; avisos: string[]; figurasFaltando: number[]; semResposta: number[]; arquivo: string
  imagens: Record<string, Blob>; urls: Record<string, string> // imagens: nome no lote → arquivo (docx e pacote)
  enviadas: Record<string, string> } // figuras do PDF: já guardadas pelo servidor (nome no lote → caminho)

/** Importar questões para o banco: lê PDF, .docx ou pacote .json, mostra a prévia e grava sem repetir as que já existem. */
export default function ImportarBanco({ admin = false, temasLista = [] }: { admin?: boolean; temasLista?: { especialidade: string; nome: string }[] }) {
  const router = useRouter()
  const [lido, setLido] = useState<Lido | null>(null), [erro, setErro] = useState<string | null>(null), [lendo, setLendo] = useState(false)
  const [fonte, setFonte] = useState('')
  const [salvando, setSalvando] = useState<string | null>(null), [aberta, setAberta] = useState<number | null>(null)
  const [resultado, setResultado] = useState<{ novas: number; repetidas: number; publicacao?: string; erroPublicacao?: string; temas?: string; explicacoes?: string; figuras?: string } | null>(null)
  // administrador: publicar no banco geral junto com a importação (já vai para todas as contas)
  const [publicar, setPublicar] = useState(true), [colecao, setColecao] = useState(''), [criarTemas, setCriarTemas] = useState(true)
  // tema para as questões que vieram sem tema (ex.: PDF de um assunto só); '' = deixar sem tema e classificar depois
  const [temaTodas, setTemaTodas] = useState('')

  async function abrir(f: File | undefined) {
    setErro(null); setLido(null); setResultado(null); setTemaTodas('')
    if (!f) return
    setLendo(true)
    try {
      const ext = f.name.toLowerCase().split('.').pop()
      let itens: ItemLido[] = [], avisos: string[] = [], semResposta: number[] = [], imagens: Record<string, Blob> = {}, fonteLote: string | null = null
      const enviadas: Record<string, string> = {}, urlsProntas: Record<string, string> = {}
      if (ext === 'pdf') {
        const fd = new FormData()
        if (f.size > 30 * 1024 * 1024) throw new ArquivoInvalido('O PDF passa de 30 MB. Divida o arquivo em partes menores.')
        if (f.size > 3.5 * 1024 * 1024) { // grande demais para ir direto: passa antes pelo armazenamento "importacao" (o servidor lê e apaga)
          const sb = supabaseBrowser(), { data: { user } } = await sb.auth.getUser()
          if (!user) throw new ArquivoInvalido('Sua sessão expirou. Entre de novo.')
          const caminho = `${user.id}/${crypto.randomUUID()}.pdf`
          const { error } = await sb.storage.from('importacao').upload(caminho, f, { contentType: 'application/pdf', upsert: false })
          if (error) throw new ArquivoInvalido(/bucket|not found/i.test(error.message) ? 'Para PDF com mais de 3,5 MB, rode supabase/migrations/0044_importacao_pdf_grande.sql no SQL Editor do Supabase.' : 'Não consegui enviar o PDF. Confira a internet e tente de novo.')
          fd.set('caminho', caminho)
        } else fd.set('pdf', f)
        const r = await lerPdfDeQuestoes(fd)
        if (r.erro || !r.paginas) throw new ArquivoInvalido(r.erro ?? 'Não consegui ler esse PDF.')
        const prova = montarQuestoes(paragrafosDoPdf(r.paginas))
        const g = lerGabarito(prova.gabaritoTexto ?? '', prova.questoes.map(q => q.numero))
        itens = itensDeQuestoes(prova.questoes, g.respostas); avisos = prova.avisos; semResposta = g.semResposta
        // as figuras que o servidor tirou do PDF (já guardadas): só o caminho e o link para a prévia
        for (const [nome, x] of Object.entries(r.figuras ?? {})) { enviadas[nome] = x.caminho; if (x.url) urlsProntas[nome] = x.url }
        if (r.avisoFiguras) avisos = [r.avisoFiguras, ...avisos]
      } else if (ext === 'docx') {
        const { paragrafos, imagens: bytes } = lerDocx(new Uint8Array(await f.arrayBuffer()))
        const prova = montarQuestoes(paragrafos)
        const g = lerGabarito(prova.gabaritoTexto ?? '', prova.questoes.map(q => q.numero))
        itens = itensDeQuestoes(prova.questoes, g.respostas); avisos = prova.avisos; semResposta = g.semResposta
        for (const [c, b] of Object.entries(bytes)) if (tipoDaImagem(c)) imagens[c] = new Blob([b as BlobPart], { type: tipoDaImagem(c)! })
      } else if (ext === 'json') {
        const p = lerPacote(JSON.parse(await f.text()))
        itens = p.itens; avisos = p.avisos; fonteLote = p.fonte
        for (const [nome, d] of Object.entries(p.imagens)) imagens[nome] = await (await fetch(d)).blob()
      } else throw new ArquivoInvalido('Use um PDF, um .docx ou um pacote .json.')
      if (!itens.length) throw new ArquivoInvalido(avisos[0] ?? 'Nenhuma questão encontrada no arquivo.')
      const urls = { ...urlsProntas, ...Object.fromEntries(Object.entries(imagens).map(([k, b]) => [k, URL.createObjectURL(b)])) }
      const figurasFaltando = ext === 'pdf' ? itens.filter(i => pareceTerFigura(i.questao) && !i.questao.blocos.some(b => b.tipo === 'imagem')).map(i => i.questao.numero) : []
      setLido({ itens, avisos, figurasFaltando, semResposta, arquivo: f.name, imagens, urls, enviadas })
      setFonte(fonteLote ?? f.name.replace(/\.[^.]+$/, ''))
    } catch (e) {
      setErro(e instanceof ArquivoInvalido ? e.message : e instanceof SyntaxError ? 'O .json não está num formato válido.' : 'Não consegui ler este arquivo.')
    } finally { setLendo(false) }
  }

  const temaEscolhido = temaTodas ? temasLista.find(t => `${t.especialidade} > ${t.nome}` === temaTodas) ?? null : null
  /** As questões como vão ser gravadas: as que vieram sem tema recebem o tema escolhido para todas (se houver). */
  const classificados = useMemo(() => (lido ? lido.itens.map(i => (i.tema || !temaEscolhido ? i : { ...i, tema: temaEscolhido })) : []), [lido, temaEscolhido])
  const resumo = lido && {
    total: lido.itens.length, comGabarito: lido.itens.filter(i => i.gabarito && !i.anulada).length,
    anuladas: lido.itens.filter(i => i.anulada).map(i => i.questao.numero), semGabarito: lido.itens.filter(i => !i.gabarito && !i.anulada).map(i => i.questao.numero),
    ia: lido.itens.filter(i => i.gabarito_origem === 'ia').length, comFigura: lido.itens.filter(i => i.questao.blocos.some(b => b.tipo === 'imagem')).length,
    comTema: classificados.filter(i => i.tema).length, semTema: classificados.filter(i => !i.tema).length, comExplicacao: lido.itens.filter(i => i.explicacao).length,
    temasNovos: [...new Set(lido.itens.flatMap(i => (i.tema && !temasLista.some(t => normalizar(t.especialidade) === normalizar(i.tema!.especialidade) && normalizar(t.nome) === normalizar(i.tema!.nome)) ? [`${i.tema.especialidade} › ${i.tema.nome}`] : [])))],
  }

  async function salvar() {
    if (!lido) return
    setErro(null)
    const sb = supabaseBrowser()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setErro('Sua sessão expirou. Entre de novo e repita a importação.'); return }
    const enviados: string[] = []
    try {
      const lista = classificados
      const destino: Record<string, string> = { ...lido.enviadas }
      enviados.push(...Object.values(lido.enviadas)) // se a importação falhar, saem também
      const usadas = [...new Set(lista.flatMap(i => i.questao.blocos.flatMap(b => (b.tipo === 'imagem' ? [b.caminho] : []))))].filter(c => lido.imagens[c])
      for (const [k, c] of usadas.entries()) {
        setSalvando(`Enviando figuras (${k + 1} de ${usadas.length})…`)
        const tipo = lido.imagens[c].type || 'image/png', caminho = `${user.id}/banco/${crypto.randomUUID()}.${extensao(c) || tipo.split('/')[1]}`
        const { error } = await sb.storage.from('provas').upload(caminho, lido.imagens[c], { contentType: tipo, upsert: false })
        if (error) throw new Error('Não foi possível enviar as figuras. Confira a internet (e se a 0028 foi rodada).')
        enviados.push(caminho); destino[c] = caminho
      }
      setSalvando('Gravando as questões…')
      const questoes = lista.map(i => ({
        // figura que não veio: sai (um texto no lugar mudaria a impressão digital e a questão duplicaria ao importar de novo com a figura)
        blocos: i.questao.blocos.flatMap((b): Bloco[] => (b.tipo === 'texto' ? [b] : destino[b.caminho] ? [{ tipo: 'imagem', caminho: destino[b.caminho] }] : []))
          .concat(i.questao.blocos.some(b => b.tipo === 'texto') ? [] : [{ tipo: 'texto', texto: '[Figura que não pôde ser importada]' }]),
        alternativas: i.questao.alternativas, gabarito: i.anulada ? null : i.gabarito, gabarito_origem: i.anulada ? null : i.gabarito_origem, anulada: i.anulada,
        comentario: i.comentario, area: i.area, discipline_id: null, topic_id: null, assunto: i.tema?.nome ?? i.assunto, banca: i.banca, ano: i.ano, fonte: fonte.trim() || null,
        tema: i.tema ? `${i.tema.especialidade} > ${i.tema.nome}` : null,
        explicacao: i.explicacao?.texto ?? null, explicacao_origem: i.explicacao?.origem ?? null,
      }))
      if (admin && publicar) setSalvando('Gravando e publicando no banco geral…')
      const r = await importarNoBanco({ questoes }, admin && publicar ? { colecao: colecao.trim() || fonte.trim() || null } : null, { criarTemas })
      if (!r.ok) throw new Error(r.erro)
      setResultado({ novas: r.novas, repetidas: r.repetidas, publicacao: r.publicacao, erroPublicacao: r.erroPublicacao, temas: r.temas, explicacoes: r.explicacoes, figuras: r.figuras }); setLido(null); setSalvando(null)
      router.refresh()
    } catch (e) {
      if (enviados.length) await sb.storage.from('provas').remove(enviados).catch(() => {})
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.'); setSalvando(null)
    }
  }

  const blocosNaTela = (bs: Bloco[]): BlocoNaTela[] => bs.map(b => (b.tipo === 'texto' ? b : { ...b, url: lido?.urls[b.caminho] ?? null }))
  const card = 'rounded-2xl border border-line bg-surface p-5'
  return (
    <div className="space-y-5">
      <label className={`${card} flex cursor-pointer flex-col items-center gap-2 border-dashed text-center hover:border-brand`}>
        <span className="font-medium">{lendo ? 'Lendo o arquivo…' : lido ? `Arquivo: ${lido.arquivo}` : 'Escolher arquivo (PDF, .docx ou pacote .json)'}</span>
        <span className="text-sm text-muted">Cada questão começa com "Questão 1" (ou "QUESTÃO 01") e as alternativas com "A)" ou "A."; o gabarito pode vir no fim, numa seção "Gabarito".</span>
        <input type="file" accept=".pdf,.docx,.json,application/pdf,application/json" className="sr-only" disabled={lendo} onChange={e => abrir(e.target.files?.[0])} />
      </label>
      {erro && <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{erro}</p>}
      {resultado && <p role="status" className="rounded-xl border border-brand/40 bg-brand/10 p-3 text-sm">
        {resultado.novas} {resultado.novas === 1 ? 'questão nova entrou' : 'questões novas entraram'} no banco.{resultado.repetidas ? ` ${resultado.repetidas} já ${resultado.repetidas === 1 ? 'estava' : 'estavam'} lá e não ${resultado.repetidas === 1 ? 'foi repetida' : 'foram repetidas'}.` : ''} <a href="/admin/questoes" className="text-brand underline">Ver as questões</a> · <a href="/banco" className="text-brand underline">Praticar</a>
        {resultado.temas && <span className="mt-1 block">{resultado.temas}</span>}
        {resultado.explicacoes && <span className="mt-1 block">{resultado.explicacoes}</span>}
        {resultado.figuras && <span className="mt-1 block">{resultado.figuras}</span>}
        {resultado.publicacao && <span className="mt-1 block">{resultado.publicacao}</span>}</p>}
      {resultado?.erroPublicacao && <p role="alert" className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm text-warn">{resultado.erroPublicacao}</p>}

      {lido && resumo && <>
        <section className={`${card} space-y-3`}>
          <h2 className="font-medium">Prévia</h2>
          <p className="text-sm">{resumo.total} questões · {resumo.comGabarito} com gabarito{resumo.ia ? ` (${resumo.ia} sugerido pela IA)` : ''}
            {resumo.comFigura > 0 && ` · ${resumo.comFigura} com figura`}
            {resumo.anuladas.length > 0 && ` · anuladas: ${faixas(resumo.anuladas)}`}</p>
          {(lido.avisos.length > 0 || resumo.semGabarito.length > 0 || lido.figurasFaltando.length > 0) && (
            <ul className="space-y-1 rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm text-warn">
              {lido.avisos.slice(0, 8).map(a => <li key={a}>{a}</li>)}
              {resumo.semGabarito.length > 0 && <li>Sem gabarito (entram no banco, mas ficam fora das listas): {faixas(resumo.semGabarito)}.</li>}
              {lido.figurasFaltando.length > 0 && <li>Estas questões falam de uma figura, mas nenhuma veio do PDF (pode ser um desenho feito no próprio PDF, que não dá para copiar): {faixas(lido.figurasFaltando)}. Depois de importar, acrescente a figura em Administração → Questões → Editar (dá para colar um print).</li>}
            </ul>)}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-muted">De onde vieram (para você lembrar)<input value={fonte} onChange={e => setFonte(e.target.value)} maxLength={120} className={inputCls + ' mt-1 w-full'} /></label>
            {admin && resumo.semTema + (temaEscolhido ? classificados.filter(i => i.tema === temaEscolhido).length : 0) > 0 && temasLista.length > 0 && (
              <label className="text-sm text-muted">Tema das que vieram sem tema
                <select value={temaTodas} onChange={e => setTemaTodas(e.target.value)} className={inputCls + ' mt-1 w-full'}>
                  <option value="">Deixar sem tema (classificar depois)</option>
                  {porEspecialidade(temasLista.map((t, k) => ({ ...t, id: String(k), area: null }))).map(([e, l]) => <optgroup key={e} label={e}>{l.map(t => <option key={t.id} value={`${t.especialidade} > ${t.nome}`}>{t.nome}</option>)}</optgroup>)}
                </select>
                <span className="mt-1 block text-xs">Útil quando o arquivo é de um tema só. Sem tema, elas aparecem em Pendências → "Sem tema", onde dá para sugerir pelo texto.</span></label>)}
          </div>
          <details>
            <summary className="cursor-pointer text-sm text-muted">Ver as questões</summary>
            <ul className="mt-3 divide-y divide-line">{classificados.map((i, k) => (
              <li key={k} className="py-2">
                <button type="button" onClick={() => setAberta(aberta === k ? null : k)} aria-expanded={aberta === k} className="w-full text-left text-sm hover:text-brand">
                  <b>{i.questao.numero}.</b> {i.banca ? <span className="text-muted">{i.banca}{i.ano ? ` ${i.ano}` : ''} · </span> : null}{textoDosBlocos(i.questao.blocos).slice(0, 140)}
                  <span className="ml-2 text-xs text-muted">{i.anulada ? 'anulada' : i.gabarito ? `gab. ${i.gabarito}` : 'sem gabarito'}{i.area ? ` · ${SIGLA_AREA[i.area]}` : ''}{i.tema ? ` · tema: ${i.tema.nome}` : i.assunto ? ` · ${i.assunto}` : ''}</span></button>
                {aberta === k && <div className="mt-3 space-y-3 rounded-xl border border-line p-3 text-sm">
                  <Enunciado blocos={blocosNaTela(i.questao.blocos)} numero={i.questao.numero} />
                  <ul className="space-y-1">{i.questao.alternativas.map(a => <li key={a.letra} className={a.letra === i.gabarito ? 'text-brand' : ''}><b>{a.letra})</b> {a.texto}</li>)}</ul>
                  {i.comentario && <p className="text-muted">{i.comentario}</p>}
                </div>}
              </li>))}</ul>
          </details>
        </section>
        {admin && resumo.comExplicacao > 0 && <p className={`${card} text-sm`}><b className="font-medium">{resumo.comExplicacao} {resumo.comExplicacao === 1 ? 'questão vem' : 'questões vêm'} com explicação.</b> <span className="text-muted">Ela é gravada na questão (também nas que já estão no banco) e, ao publicar, vai para as outras contas com a etiqueta de IA. O comentário, não.</span></p>}
        {admin && resumo.comTema > 0 && <section className={`${card} space-y-2 text-sm`}>
          <p><b className="font-medium">{resumo.comTema} {resumo.comTema === 1 ? 'questão vem' : 'questões vêm'} com tema.</b> <span className="text-muted">Ao adicionar, o tema é aplicado nelas, inclusive nas que já estão no seu banco (essas não se repetem: só recebem o tema).</span></p>
          {resumo.temasNovos.length > 0 && <label className="flex items-start gap-2"><input type="checkbox" checked={criarTemas} onChange={e => setCriarTemas(e.target.checked)} className="mt-0.5 size-4 accent-brand" />
            <span>Criar na Lista de temas os {resumo.temasNovos.length} que ainda não existem <span className="text-muted">({resumo.temasNovos.slice(0, 6).join('; ')}{resumo.temasNovos.length > 6 ? '…' : ''}). Sem marcar, as questões desses temas ficam sem tema.</span></span></label>}
        </section>}
        {admin && <section className={`${card} space-y-2 text-sm`}>
          <label className="flex items-start gap-2"><input type="checkbox" checked={publicar} onChange={e => setPublicar(e.target.checked)} className="mt-0.5 size-4 accent-brand" />
            <span><b className="font-medium">Publicar também no banco geral</b> <span className="text-muted">— todas as contas recebem estas questões (enunciado, figuras, alternativas, gabarito, tema e explicação; o comentário não vai).</span></span></label>
          {publicar && <label className="block text-muted">Coleção (opcional)<input value={colecao} onChange={e => setColecao(e.target.value)} maxLength={120} placeholder={fonte || 'Ex.: Anestesiologia – UFMA'} className={inputCls + ' mt-1 w-full'} /></label>}
        </section>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={salvar} disabled={!!salvando} className="min-h-12 rounded-xl bg-brand px-6 font-medium text-black disabled:opacity-50">
            {salvando ?? (admin && publicar ? `Adicionar ${resumo.total} e publicar para todos` : `Adicionar ${resumo.total} ao banco`)}</button>
          <span className="text-xs text-muted">Questões que já estão no banco (mesmo texto) não são repetidas.</span>
        </div>
      </>}
    </div>)
}
