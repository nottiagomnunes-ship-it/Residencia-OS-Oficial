'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'
import { lerDocx, tipoDaImagem, extensao, ArquivoInvalido } from '@/lib/engine/provas-docx'
import { paragrafosDoPdf, pareceTerFigura } from '@/lib/engine/provas-pdf'
import { montarQuestoes, lerGabarito, textoDosBlocos, faixas, type Bloco } from '@/lib/engine/provas'
import { lerPacote, itensDeQuestoes, classificar, acharDisciplina, type ItemLido, type Disc, type Assunto } from '@/lib/engine/banco'
import { SIGLA_AREA, normalizar } from '@/lib/engine/areas'
import { lerPdfDeQuestoes, criarDisciplinaDoBanco, importarNoBanco } from '@/lib/banco'
import { inputCls } from '@/components/ui'
import { Enunciado } from '@/components/provas/Enunciado'
import type { BlocoNaTela } from '@/lib/provas-data'

type Lido = { itens: ItemLido[]; avisos: string[]; figurasFaltando: number[]; semResposta: number[]; arquivo: string
  imagens: Record<string, Blob>; urls: Record<string, string> } // imagens: nome no lote → arquivo (docx e pacote)

const NOVA = '__nova__'
/** "anestesio_2.pdf" → "Anestesio"; "Cardiologia - lote 3.json" → "Cardiologia". Só um palpite para o nome da disciplina. */
const palpiteDisciplina = (arquivo: string) => {
  const b = arquivo.replace(/\.[^.]+$/, '').replace(/[_\-]+/g, ' ').replace(/\b(lote|parte|banco|questoes|questões)\b.*$/i, '').replace(/\d+/g, '').trim()
  return b ? b[0].toUpperCase() + b.slice(1).toLowerCase() : ''
}

/** Importar questões para o banco: lê PDF, .docx ou pacote .json, mostra a prévia e grava sem repetir as que já existem. */
export default function ImportarBanco({ disciplinas, assuntos }: { disciplinas: Disc[]; assuntos: Assunto[] }) {
  const router = useRouter()
  const [lido, setLido] = useState<Lido | null>(null), [erro, setErro] = useState<string | null>(null), [lendo, setLendo] = useState(false)
  const [disc, setDisc] = useState(''), [novaDisc, setNovaDisc] = useState(''), [fonte, setFonte] = useState('')
  const [salvando, setSalvando] = useState<string | null>(null), [aberta, setAberta] = useState<number | null>(null)
  const [resultado, setResultado] = useState<{ novas: number; repetidas: number } | null>(null)

  async function abrir(f: File | undefined) {
    setErro(null); setLido(null); setResultado(null)
    if (!f) return
    setLendo(true)
    try {
      const ext = f.name.toLowerCase().split('.').pop()
      let itens: ItemLido[] = [], avisos: string[] = [], semResposta: number[] = [], imagens: Record<string, Blob> = {}, discNome: string | null = null, fonteLote: string | null = null
      if (ext === 'pdf') {
        const fd = new FormData(); fd.set('pdf', f)
        const r = await lerPdfDeQuestoes(fd)
        if (r.erro || !r.paginas) throw new ArquivoInvalido(r.erro ?? 'Não consegui ler esse PDF.')
        const prova = montarQuestoes(paragrafosDoPdf(r.paginas))
        const g = lerGabarito(prova.gabaritoTexto ?? '', prova.questoes.map(q => q.numero))
        itens = itensDeQuestoes(prova.questoes, g.respostas); avisos = prova.avisos; semResposta = g.semResposta
      } else if (ext === 'docx') {
        const { paragrafos, imagens: bytes } = lerDocx(new Uint8Array(await f.arrayBuffer()))
        const prova = montarQuestoes(paragrafos)
        const g = lerGabarito(prova.gabaritoTexto ?? '', prova.questoes.map(q => q.numero))
        itens = itensDeQuestoes(prova.questoes, g.respostas); avisos = prova.avisos; semResposta = g.semResposta
        for (const [c, b] of Object.entries(bytes)) if (tipoDaImagem(c)) imagens[c] = new Blob([b as BlobPart], { type: tipoDaImagem(c)! })
      } else if (ext === 'json') {
        const p = lerPacote(JSON.parse(await f.text()))
        itens = p.itens; avisos = p.avisos; discNome = p.disciplina; fonteLote = p.fonte
        for (const [nome, d] of Object.entries(p.imagens)) imagens[nome] = await (await fetch(d)).blob()
      } else throw new ArquivoInvalido('Use um PDF, um .docx ou um pacote .json.')
      if (!itens.length) throw new ArquivoInvalido(avisos[0] ?? 'Nenhuma questão encontrada no arquivo.')
      const urls = Object.fromEntries(Object.entries(imagens).map(([k, b]) => [k, URL.createObjectURL(b)]))
      const figurasFaltando = ext === 'pdf' ? itens.filter(i => pareceTerFigura(i.questao)).map(i => i.questao.numero) : []
      setLido({ itens, avisos, figurasFaltando, semResposta, arquivo: f.name, imagens, urls })
      const nome = discNome ?? palpiteDisciplina(f.name)
      // "anestesio_2.pdf" também acha "Anestesiologia" (começo do nome, com pelo menos 5 letras)
      const achada = acharDisciplina(nome, disciplinas) ?? (nome.length >= 5 ? disciplinas.find(d => normalizar(d.nome).startsWith(normalizar(nome))) ?? null : null)
      setDisc(achada?.id ?? (nome ? NOVA : '')); setNovaDisc(nome); setFonte(fonteLote ?? f.name.replace(/\.[^.]+$/, ''))
    } catch (e) {
      setErro(e instanceof ArquivoInvalido ? e.message : e instanceof SyntaxError ? 'O .json não está num formato válido.' : 'Não consegui ler este arquivo.')
    } finally { setLendo(false) }
  }

  const padrao = disciplinas.find(d => d.id === disc) ?? null
  const classificados = useMemo(() => (lido ? classificar(lido.itens, disciplinas, assuntos, padrao) : []), [lido, disciplinas, assuntos, padrao])
  const resumo = lido && {
    total: lido.itens.length, comGabarito: lido.itens.filter(i => i.gabarito && !i.anulada).length,
    anuladas: lido.itens.filter(i => i.anulada).map(i => i.questao.numero), semGabarito: lido.itens.filter(i => !i.gabarito && !i.anulada).map(i => i.questao.numero),
    ia: lido.itens.filter(i => i.gabarito_origem === 'ia').length, comAssunto: classificados.filter(i => i.topic_id).length,
  }

  async function salvar() {
    if (!lido) return
    setErro(null)
    const sb = supabaseBrowser()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setErro('Sua sessão expirou. Entre de novo e repita a importação.'); return }
    const enviados: string[] = []
    try {
      let lista = classificados
      if (disc === NOVA) {
        setSalvando('Criando a disciplina…')
        const r = await criarDisciplinaDoBanco(novaDisc)
        if (!r.id) throw new Error(r.erro ?? 'Não foi possível criar a disciplina.')
        lista = classificar(lido.itens, [...disciplinas, { id: r.id, nome: novaDisc, area: null }], assuntos, { id: r.id, nome: novaDisc, area: null })
      }
      const destino: Record<string, string> = {}
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
        blocos: i.questao.blocos.map((b): Bloco => (b.tipo === 'texto' ? b : destino[b.caminho] ? { tipo: 'imagem', caminho: destino[b.caminho] } : { tipo: 'texto', texto: '[Figura que não pôde ser importada]' })),
        alternativas: i.questao.alternativas, gabarito: i.anulada ? null : i.gabarito, gabarito_origem: i.anulada ? null : i.gabarito_origem, anulada: i.anulada,
        comentario: i.comentario, area: i.area, discipline_id: i.discipline_id, topic_id: i.topic_id, assunto: i.assunto, banca: i.banca, ano: i.ano, fonte: fonte.trim() || null,
      }))
      const r = await importarNoBanco({ questoes })
      if (!r.ok) throw new Error(r.erro)
      setResultado({ novas: r.novas, repetidas: r.repetidas }); setLido(null); setSalvando(null)
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
        {resultado.novas} {resultado.novas === 1 ? 'questão nova entrou' : 'questões novas entraram'} no banco.{resultado.repetidas ? ` ${resultado.repetidas} já ${resultado.repetidas === 1 ? 'estava' : 'estavam'} lá e não ${resultado.repetidas === 1 ? 'foi repetida' : 'foram repetidas'}.` : ''} <a href="/banco" className="text-brand underline">Ver o banco</a></p>}

      {lido && resumo && <>
        <section className={`${card} space-y-3`}>
          <h2 className="font-medium">Prévia</h2>
          <p className="text-sm">{resumo.total} questões · {resumo.comGabarito} com gabarito{resumo.ia ? ` (${resumo.ia} sugerido pela IA)` : ''}
            {resumo.anuladas.length > 0 && ` · anuladas: ${faixas(resumo.anuladas)}`}</p>
          {(lido.avisos.length > 0 || resumo.semGabarito.length > 0 || lido.figurasFaltando.length > 0) && (
            <ul className="space-y-1 rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm text-warn">
              {lido.avisos.slice(0, 8).map(a => <li key={a}>{a}</li>)}
              {resumo.semGabarito.length > 0 && <li>Sem gabarito (entram no banco, mas ficam fora das listas): {faixas(resumo.semGabarito)}.</li>}
              {lido.figurasFaltando.length > 0 && <li>O PDF não traz as figuras para o app. Estas questões parecem depender de uma: {faixas(lido.figurasFaltando)}.</li>}
            </ul>)}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-muted">Disciplina destas questões
              <select value={disc} onChange={e => setDisc(e.target.value)} className={inputCls + ' mt-1 w-full'}>
                <option value="">Sem disciplina</option>
                {disciplinas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                <option value={NOVA}>Criar uma nova…</option>
              </select></label>
            {disc === NOVA && <label className="text-sm text-muted">Nome da nova disciplina<input value={novaDisc} onChange={e => setNovaDisc(e.target.value)} maxLength={80} className={inputCls + ' mt-1 w-full'} /></label>}
            <label className="text-sm text-muted">De onde vieram (para você lembrar)<input value={fonte} onChange={e => setFonte(e.target.value)} maxLength={120} className={inputCls + ' mt-1 w-full'} /></label>
          </div>
          {resumo.comAssunto > 0 && <p className="text-xs text-muted">{resumo.comAssunto} questões foram ligadas a assuntos que já existem em Matérias → Assuntos.</p>}
          <details>
            <summary className="cursor-pointer text-sm text-muted">Ver as questões</summary>
            <ul className="mt-3 divide-y divide-line">{classificados.map((i, k) => (
              <li key={k} className="py-2">
                <button type="button" onClick={() => setAberta(aberta === k ? null : k)} aria-expanded={aberta === k} className="w-full text-left text-sm hover:text-brand">
                  <b>{i.questao.numero}.</b> {i.banca ? <span className="text-muted">{i.banca}{i.ano ? ` ${i.ano}` : ''} · </span> : null}{textoDosBlocos(i.questao.blocos).slice(0, 140)}
                  <span className="ml-2 text-xs text-muted">{i.anulada ? 'anulada' : i.gabarito ? `gab. ${i.gabarito}` : 'sem gabarito'}{i.area ? ` · ${SIGLA_AREA[i.area]}` : ''}{i.assunto ? ` · ${i.assunto}` : ''}</span></button>
                {aberta === k && <div className="mt-3 space-y-3 rounded-xl border border-line p-3 text-sm">
                  <Enunciado blocos={blocosNaTela(i.questao.blocos)} numero={i.questao.numero} />
                  <ul className="space-y-1">{i.questao.alternativas.map(a => <li key={a.letra} className={a.letra === i.gabarito ? 'text-brand' : ''}><b>{a.letra})</b> {a.texto}</li>)}</ul>
                  {i.comentario && <p className="text-muted">{i.comentario}</p>}
                </div>}
              </li>))}</ul>
          </details>
        </section>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={salvar} disabled={!!salvando || (disc === NOVA && !novaDisc.trim())} className="min-h-12 rounded-xl bg-brand px-6 font-medium text-black disabled:opacity-50">
            {salvando ?? `Adicionar ${resumo.total} ao banco`}</button>
          <span className="text-xs text-muted">Questões que já estão no banco (mesmo texto) não são repetidas.</span>
        </div>
      </>}
    </div>)
}
