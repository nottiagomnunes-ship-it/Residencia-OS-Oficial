'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'
import { lerDocx, tipoDaImagem, extensao, ArquivoInvalido } from '@/lib/engine/provas-docx'
import {
  montarQuestoes, sugerirAreas, textoDosBlocos, palpiteDeNome, lerGabarito, itensDoGabarito, faixas, type ProvaLida, type Bloco,
} from '@/lib/engine/provas'
import { AREAS, ROTULO_AREA, SIGLA_AREA, COR_AREA, ehArea, type Area } from '@/lib/engine/areas'
import { salvarProva } from '@/lib/provas'
import { inputCls } from '@/components/ui'
import { Enunciado } from './Enunciado'
import type { BlocoNaTela } from '@/lib/provas-data'

const LIMITE_FIGURA = 5 * 1024 * 1024
type Lido = { prova: ProvaLida; imagens: Record<string, Uint8Array>; urls: Record<string, string>; ruins: Set<string>; arquivo: string }

/** Importar uma prova do Word: lê o arquivo aqui no aparelho, mostra a prévia, e só ao salvar envia as figuras e grava a prova. */
export default function ImportarProva() {
  const router = useRouter()
  const [lido, setLido] = useState<Lido | null>(null), [erro, setErro] = useState<string | null>(null)
  const [nome, setNome] = useState(''), [banca, setBanca] = useState(''), [ano, setAno] = useState('')
  const [gabarito, setGabarito] = useState(''), [areas, setAreas] = useState<(Area | null)[]>([]), [porBlocos, setPorBlocos] = useState(false)
  const [faixa, setFaixa] = useState({ de: '', ate: '', area: '' as Area | '' }), [aberta, setAberta] = useState<number | null>(null)
  const [salvando, setSalvando] = useState<string | null>(null)

  useEffect(() => () => { if (lido) Object.values(lido.urls).forEach(u => URL.revokeObjectURL(u)) }, [lido])

  async function abrir(f: File | undefined) {
    setErro(null); setLido(null)
    if (!f) return
    if (!/\.docx$/i.test(f.name)) { setErro('Escolha um arquivo do Word (.docx). PDF e .doc antigo ainda não funcionam aqui.'); return }
    try {
      const { paragrafos, imagens } = lerDocx(new Uint8Array(await f.arrayBuffer()))
      const prova = montarQuestoes(paragrafos)
      const ruins = new Set(Object.keys(imagens).filter(c => !tipoDaImagem(c) || imagens[c].length > LIMITE_FIGURA))
      const urls = Object.fromEntries(Object.entries(imagens).filter(([c]) => !ruins.has(c)).map(([c, b]) => [c, URL.createObjectURL(new Blob([b as BlobPart], { type: tipoDaImagem(c)! }))]))
      const p = palpiteDeNome(prova.titulo, f.name)
      setNome(p.nome); setBanca(p.banca); setAno(p.ano ? String(p.ano) : ''); setGabarito(prova.gabaritoTexto ?? '')
      const s = sugerirAreas(prova.questoes.map(q => textoDosBlocos(q.blocos) + '\n' + q.alternativas.map(a => a.texto).join('\n')))
      setAreas(s.areas); setPorBlocos(s.porBlocos)
      setLido({ prova, imagens, urls, ruins, arquivo: f.name })
    } catch (e) { setErro(e instanceof ArquivoInvalido ? e.message : 'Não consegui ler este arquivo. Confira se ele abre no Word e tente de novo.') }
  }

  const numeros = useMemo(() => lido?.prova.questoes.map(q => q.numero) ?? [], [lido])
  const gab = useMemo(() => {
    if (!lido || !gabarito.trim()) return null
    const l = lerGabarito(gabarito, numeros)
    return { ...l, ...itensDoGabarito(lido.prova.questoes.map(q => ({ numero: q.numero, alternativas: q.alternativas.length })), l.respostas) }
  }, [gabarito, lido, numeros])
  const contagem = useMemo(() => [...AREAS, null].map(a => ({ a, n: areas.filter(x => x === a).length })).filter(x => x.n > 0), [areas])
  const figuras = lido ? lido.prova.questoes.reduce((s, q) => s + q.blocos.filter(b => b.tipo === 'imagem').length, 0) : 0

  function aplicarFaixa() {
    const de = Number(faixa.de), ate = Number(faixa.ate)
    if (!lido || !Number.isInteger(de) || !Number.isInteger(ate) || de > ate) return
    setAreas(as => as.map((a, i) => { const n = lido.prova.questoes[i].numero; return n >= de && n <= ate ? (faixa.area || null) : a }))
  }

  async function salvar() {
    if (!lido) return
    setErro(null)
    const sb = supabaseBrowser()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setErro('Sua sessão expirou. Entre de novo e repita a importação.'); return }
    const id = crypto.randomUUID(), pasta = `${user.id}/${id}/`, enviados: string[] = [], destino: Record<string, string> = {}
    try {
      const usadas = Object.keys(lido.urls)
      for (const [i, c] of usadas.entries()) {
        setSalvando(`Enviando figuras (${i + 1} de ${usadas.length})…`)
        const caminho = pasta + `${i + 1}.${extensao(c)}`
        const { error } = await sb.storage.from('provas').upload(caminho, new Blob([lido.imagens[c] as BlobPart], { type: tipoDaImagem(c)! }), { contentType: tipoDaImagem(c)!, upsert: false })
        if (error) throw new Error(/bucket/i.test(error.message) ? 'O armazenamento das figuras não existe ainda: rode a 0028_provas.sql no Supabase.' : 'Não foi possível enviar as figuras. Confira a internet e tente de novo.')
        enviados.push(caminho); destino[c] = caminho
      }
      setSalvando('Gravando a prova…')
      const resp = gab ? new Map(gab.itens.map(x => [x.numero, x])) : new Map()
      const questoes = lido.prova.questoes.map((q, i) => ({
        numero: q.numero, alternativas: q.alternativas, area: areas[i] ?? null,
        gabarito: resp.get(q.numero)?.gabarito ?? null, anulada: resp.get(q.numero)?.anulada ?? false,
        blocos: q.blocos.map((b): Bloco => (b.tipo === 'texto' ? b : destino[b.caminho] ? { tipo: 'imagem', caminho: destino[b.caminho] } : { tipo: 'texto', texto: '[Figura que não pôde ser importada]' })),
      }))
      const r = await salvarProva({ id, nome, banca, ano: ano || null, questoes })
      if (!r.ok) throw new Error(r.erro)
      router.push(`/provas/${r.id}?ok=${encodeURIComponent('Prova importada.')}`)
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
        <span className="font-medium">{lido ? `Arquivo: ${lido.arquivo}` : 'Escolher o arquivo da prova (.docx)'}</span>
        <span className="text-sm text-muted">Cada questão começa com "QUESTÃO 1", "QUESTÃO 2"... e as alternativas com "A)", "B)"... O arquivo é lido aqui no aparelho.</span>
        <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" onChange={e => abrir(e.target.files?.[0])} />
      </label>
      {erro && <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{erro}</p>}

      {lido && <>
        <section className={`${card} space-y-3`}>
          <h2 className="font-medium">Prévia</h2>
          <p className="text-sm">{lido.prova.questoes.length} questões · {figuras} {figuras === 1 ? 'figura' : 'figuras'}
            {lido.prova.questoes.length > 0 && ` · ${Math.min(...lido.prova.questoes.map(q => q.alternativas.length))} a ${Math.max(...lido.prova.questoes.map(q => q.alternativas.length))} alternativas`}</p>
          {(lido.prova.avisos.length > 0 || lido.ruins.size > 0) && (
            <ul className="space-y-1 rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm text-warn">
              {lido.prova.avisos.map(a => <li key={a}>{a}</li>)}
              {lido.ruins.size > 0 && <li>{lido.ruins.size} figura(s) em formato que o navegador não mostra (ou maiores que 5 MB) não serão importadas. Salve-as como PNG ou JPG no Word.</li>}
            </ul>)}
          <div className="grid gap-3 sm:grid-cols-[1fr_8rem_6rem]">
            <label className="text-sm text-muted">Nome<input value={nome} onChange={e => setNome(e.target.value)} maxLength={120} className={inputCls + ' mt-1 w-full'} /></label>
            <label className="text-sm text-muted">Banca<input value={banca} onChange={e => setBanca(e.target.value)} maxLength={60} className={inputCls + ' mt-1 w-full'} /></label>
            <label className="text-sm text-muted">Ano<input value={ano} onChange={e => setAno(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" className={inputCls + ' mt-1 w-full'} /></label>
          </div>
        </section>

        <section className={`${card} space-y-3`}>
          <h2 className="font-medium">Gabarito <span className="text-sm font-normal text-muted">(pode deixar para depois)</span></h2>
          <textarea value={gabarito} onChange={e => setGabarito(e.target.value)} rows={4} placeholder={'Cole aqui. Exemplos: "1-B 2-C 3-A", uma tabela copiada do PDF, ou só as letras em sequência. Anulada: X.'}
            className={inputCls + ' w-full font-mono'} />
          {gab && <p className="text-sm">
            <span className="text-brand">Lidas {gab.itens.length} de {numeros.length}.</span>
            {gab.faltando.length > 0 && <span className="text-muted"> Faltam: {faixas(gab.faltando)}.</span>}
            {gab.anuladas.length > 0 && <span className="text-muted"> Anuladas: {faixas(gab.anuladas)}.</span>}
            {gab.invalidas.length > 0 && <span className="text-warn"> Letra que não existe na questão: {faixas(gab.invalidas)}.</span>}
            {gab.fora.length > 0 && <span className="text-warn"> Números fora da prova: {faixas(gab.fora)}.</span>}
          </p>}
        </section>

        <section className={`${card} space-y-3`}>
          <h2 className="font-medium">Áreas</h2>
          <p className="text-sm text-muted">{porBlocos ? 'A prova parece dividida em 5 blocos, um por área. Confira abaixo; se algo estiver errado, ajuste por faixa.'
            : 'Sugestão pelo texto de cada questão. Ela só serve para o resultado por área; ajuste por faixa se quiser.'}</p>
          <div className="flex flex-wrap gap-2 text-sm">{contagem.map(({ a, n }) => (
            <span key={a ?? 'sem'} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1">
              <span aria-hidden className="size-2.5 rounded-full" style={{ background: a ? COR_AREA[a] : 'var(--color-muted, #888)' }} />{a ? SIGLA_AREA[a] : 'Sem área'}: {n}</span>))}</div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm text-muted">De<input value={faixa.de} onChange={e => setFaixa(f => ({ ...f, de: e.target.value }))} inputMode="numeric" className={inputCls + ' mt-1 block w-20'} /></label>
            <label className="text-sm text-muted">Até<input value={faixa.ate} onChange={e => setFaixa(f => ({ ...f, ate: e.target.value }))} inputMode="numeric" className={inputCls + ' mt-1 block w-20'} /></label>
            <label className="text-sm text-muted">Área<select value={faixa.area} onChange={e => setFaixa(f => ({ ...f, area: ehArea(e.target.value) ? e.target.value : '' }))} className={inputCls + ' mt-1 block'}>
              <option value="">Sem área</option>{AREAS.map(a => <option key={a} value={a}>{ROTULO_AREA[a]}</option>)}</select></label>
            <button type="button" onClick={aplicarFaixa} className="min-h-11 rounded-xl border border-line px-4 text-sm hover:border-brand">Aplicar</button>
          </div>
          <details>
            <summary className="cursor-pointer text-sm text-muted">Ver as questões</summary>
            <ul className="mt-3 divide-y divide-line">{lido.prova.questoes.map((q, i) => (
              <li key={q.numero} className="py-2">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setAberta(aberta === i ? null : i)} aria-expanded={aberta === i} className="min-w-0 flex-1 truncate text-left text-sm hover:text-brand">
                    <b>{q.numero}.</b> {textoDosBlocos(q.blocos).slice(0, 140)}</button>
                  <select aria-label={`Área da questão ${q.numero}`} value={areas[i] ?? ''} onChange={e => { const v = e.target.value; setAreas(as => as.map((a, j) => (j === i ? (ehArea(v) ? v : null) : a))) }}
                    className={inputCls + ' shrink-0 py-1 text-xs'}><option value="">Sem área</option>{AREAS.map(a => <option key={a} value={a}>{SIGLA_AREA[a]}</option>)}</select>
                </div>
                {aberta === i && <div className="mt-3 space-y-3 rounded-xl border border-line p-3 text-sm">
                  <Enunciado blocos={blocosNaTela(q.blocos)} numero={q.numero} />
                  <ul className="space-y-1">{q.alternativas.map(a => <li key={a.letra}><b>{a.letra})</b> {a.texto}</li>)}</ul>
                </div>}
              </li>))}</ul>
          </details>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={salvar} disabled={!!salvando || !nome.trim() || !lido.prova.questoes.length}
            className="min-h-12 rounded-xl bg-brand px-6 font-medium text-black disabled:opacity-50">{salvando ?? 'Salvar prova'}</button>
          {!nome.trim() && <span className="text-sm text-warn">Dê um nome à prova.</span>}
        </div>
      </>}
    </div>)
}
