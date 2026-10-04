import { normalizar, ehArea, lerArea, sugerirArea, type Area } from './areas'
import { LETRAS, ehLetra, ehUuid, sugerirAreaDaQuestao, textoDosBlocos, type Alternativa, type Bloco, type Letra, type QuestaoLida } from './provas'
import { extrairOrigem } from './provas-pdf'

/** Uma questão pronta para entrar no banco (já com a classificação resolvida para os ids da pessoa). */
export type QuestaoDoBanco = {
  blocos: Bloco[]; alternativas: Alternativa[]; gabarito: Letra | null; gabarito_origem: 'oficial' | 'ia' | null; anulada: boolean
  comentario: string | null; area: Area | null; discipline_id: string | null; topic_id: string | null; assunto: string | null
  banca: string | null; ano: number | null; fonte: string | null
}

/** O texto que identifica a questão (sem acentos, maiúsculas, espaços nem pontuação): a mesma questão importada de novo dá o mesmo texto. */
export const textoParaHash = (blocos: Bloco[], alternativas: Alternativa[]) =>
  normalizar([textoDosBlocos(blocos.filter(b => b.tipo === 'texto')), ...alternativas.map(a => a.texto)].join(' ')).replace(/ /g, '')

// ---------- Pacote (.json) preparado fora do app ----------

/**
 * Formato do pacote (versão 1). Só "questoes", "enunciado" e "alternativas" são obrigatórios:
 * {
 *   "formato": "residencia-os/banco", "versao": 1, "fonte": "Anestesiologia — lote 1", "disciplina": "Anestesiologia",
 *   "questoes": [{ "enunciado": "texto" | ["parágrafo", {"imagem": "fig1.png"}], "alternativas": ["texto A", "texto B"] | [{"letra": "A", "texto": "..."}],
 *                  "gabarito": "C", "gabarito_origem": "oficial" | "ia", "anulada": false, "comentario": "...",
 *                  "disciplina": "...", "assunto": "...", "area": "cirurgia", "banca": "UFMA", "ano": 2018 }],
 *   "imagens": { "fig1.png": "data:image/png;base64,..." }
 * }
 */
export type ItemLido = {
  questao: QuestaoLida; gabarito: Letra | null; gabarito_origem: 'oficial' | 'ia' | null; anulada: boolean; comentario: string | null
  disciplina: string | null; assunto: string | null; area: Area | null; banca: string | null; ano: number | null
}
export type LoteLido = { itens: ItemLido[]; imagens: Record<string, string>; fonte: string | null; disciplina: string | null; avisos: string[] }

const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
const IMAGEM_DATA = /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/

export function lerPacote(json: unknown): LoteLido {
  const p = json as Record<string, unknown>, avisos: string[] = []
  if (!p || typeof p !== 'object' || !Array.isArray(p.questoes)) return { itens: [], imagens: {}, fonte: null, disciplina: null, avisos: ['O arquivo não tem a lista "questoes". Confira se é um pacote do Residência OS.'] }
  const imagens: Record<string, string> = {}
  for (const [nome, d] of Object.entries((p.imagens as Record<string, unknown>) ?? {})) if (typeof d === 'string' && IMAGEM_DATA.test(d) && d.length < 7_000_000) imagens[nome] = d
  const itens: ItemLido[] = []
  ;(p.questoes as Record<string, unknown>[]).forEach((q, i) => {
    const n = i + 1
    const enun = typeof q?.enunciado === 'string' ? [q.enunciado] : Array.isArray(q?.enunciado) ? q.enunciado : []
    const blocos: Bloco[] = []
    for (const e of enun as unknown[]) {
      if (typeof e === 'string' && e.trim()) blocos.push({ tipo: 'texto', texto: e.trim().slice(0, 20000) })
      else if (e && typeof e === 'object' && typeof (e as { imagem?: unknown }).imagem === 'string') {
        const nome = (e as { imagem: string }).imagem
        if (imagens[nome]) blocos.push({ tipo: 'imagem', caminho: nome }); else avisos.push(`Questão ${n}: a figura "${nome}" não está no pacote.`)
      }
    }
    const altsBrutas = Array.isArray(q?.alternativas) ? q.alternativas : []
    const alternativas: Alternativa[] = altsBrutas.slice(0, 5).map((a, k) => ({ letra: LETRAS[k], texto: (typeof a === 'string' ? a : str((a as { texto?: unknown })?.texto, 5000) ?? '').trim().slice(0, 5000) }))
    if (!blocos.length || alternativas.length < 2) { avisos.push(`Questão ${n}: sem enunciado ou com menos de 2 alternativas; foi ignorada.`); return }
    const g = typeof q.gabarito === 'string' ? q.gabarito.trim().toUpperCase() : ''
    const gabarito = ehLetra(g) && LETRAS.indexOf(g) < alternativas.length ? g : null
    if (g && !gabarito && g !== 'X') avisos.push(`Questão ${n}: gabarito "${g}" não é uma das alternativas.`)
    const ano = Number(q.ano)
    itens.push({
      questao: { numero: n, blocos, alternativas }, gabarito, gabarito_origem: gabarito ? (q.gabarito_origem === 'ia' ? 'ia' : 'oficial') : null,
      anulada: q.anulada === true || g === 'X', comentario: str(q.comentario, 5000), disciplina: str(q.disciplina, 120), assunto: str(q.assunto, 120),
      area: lerArea(q.area), banca: str(q.banca, 60), ano: Number.isInteger(ano) && ano > 1980 && ano < 2100 ? ano : null,
    })
  })
  return { itens, imagens, fonte: str(p.fonte, 120), disciplina: str(p.disciplina, 120), avisos }
}

/** Questões de um PDF ou .docx (já montadas) + o gabarito lido → itens do lote. Banca e ano saem da linha "UFMA 2018 ACESSO DIRETO". */
export function itensDeQuestoes(questoes: QuestaoLida[], gabarito: Map<number, Letra | 'X'>): ItemLido[] {
  return questoes.map(q0 => {
    const { questao, banca, ano } = extrairOrigem(q0)
    const g = gabarito.get(q0.numero)
    return { questao, gabarito: g && g !== 'X' ? g : null, gabarito_origem: g && g !== 'X' ? 'oficial' : null, anulada: !!q0.anulada || g === 'X',
      comentario: null, disciplina: null, assunto: null, area: null, banca, ano }
  })
}

// ---------- Classificação: nomes → ids da pessoa ----------

export type Disc = { id: string; nome: string; area: Area | null }
export type Assunto = { id: string; nome: string; discipline_id: string }

/** A disciplina da pessoa com esse nome (sem diferenciar acento e maiúsculas), se existir. */
export const acharDisciplina = (nome: string | null, ds: Disc[]) => (nome ? ds.find(d => normalizar(d.nome) === normalizar(nome)) ?? null : null)

/**
 * Resolve cada item: disciplina (a do item, senão a padrão do lote), assunto (só se existir em Conteúdos com esse nome; senão fica como rótulo)
 * e área (a do item, senão a da disciplina, senão a sugerida pelo texto).
 */
export function classificar(itens: ItemLido[], ds: Disc[], ts: Assunto[], padrao: Disc | null) {
  return itens.map(i => {
    const d = acharDisciplina(i.disciplina, ds) ?? padrao
    const t = d && i.assunto ? ts.find(x => x.discipline_id === d.id && normalizar(x.nome) === normalizar(i.assunto!)) ?? null : null
    const area = i.area ?? d?.area ?? (d ? sugerirArea(d.nome) : null) ?? sugerirAreaDaQuestao(textoDosBlocos(i.questao.blocos))
    return { ...i, discipline_id: d?.id ?? null, topic_id: t?.id ?? null, area }
  })
}

// ---------- Conferência no servidor ----------

/** Confere o lote vindo do navegador (formato, limites, letras, figuras só na pasta da pessoa). Devolve as questões limpas ou o motivo da recusa. */
export function validarLote(v: unknown, uid: string): { ok: true; questoes: QuestaoDoBanco[] } | { ok: false; erro: string } {
  const p = v as { questoes?: unknown }
  if (!p || !Array.isArray(p.questoes) || !p.questoes.length) return { ok: false, erro: 'Nenhuma questão para importar.' }
  if (p.questoes.length > 1000) return { ok: false, erro: 'Importe até 1000 questões por vez.' }
  const pasta = `${uid}/banco/`, out: QuestaoDoBanco[] = []
  for (const [i, b] of (p.questoes as Record<string, unknown>[]).entries()) {
    const n = i + 1
    if (!Array.isArray(b?.blocos) || !b.blocos.length || b.blocos.length > 60) return { ok: false, erro: `Questão ${n}: enunciado inválido.` }
    const blocos: Bloco[] = []
    for (const x of b.blocos as Record<string, unknown>[]) {
      if (x?.tipo === 'texto' && typeof x.texto === 'string' && x.texto.trim()) blocos.push({ tipo: 'texto', texto: x.texto.trim().slice(0, 20000) })
      else if (x?.tipo === 'imagem' && typeof x.caminho === 'string' && x.caminho.startsWith(pasta) && /^[\w-]+\/banco\/[\w.-]{1,100}$/.test(x.caminho)) blocos.push({ tipo: 'imagem', caminho: x.caminho })
      else return { ok: false, erro: `Questão ${n}: figura ou trecho inválido.` }
    }
    if (!Array.isArray(b.alternativas) || b.alternativas.length < 2 || b.alternativas.length > 5) return { ok: false, erro: `Questão ${n}: precisa ter de 2 a 5 alternativas.` }
    const alternativas = (b.alternativas as Record<string, unknown>[]).map((a, k) => ({ letra: LETRAS[k], texto: String(a?.texto ?? '').trim().slice(0, 5000) }))
    if ((b.alternativas as Record<string, unknown>[]).some((a, k) => a?.letra !== LETRAS[k])) return { ok: false, erro: `Questão ${n}: alternativas fora de ordem.` }
    const gabarito = b.gabarito == null || b.gabarito === '' ? null : b.gabarito
    if (gabarito !== null && !(ehLetra(gabarito) && LETRAS.indexOf(gabarito) < alternativas.length)) return { ok: false, erro: `Questão ${n}: o gabarito não é uma das alternativas.` }
    const ano = b.ano == null || b.ano === '' ? null : Number(b.ano)
    out.push({
      blocos, alternativas, gabarito, gabarito_origem: gabarito ? (b.gabarito_origem === 'ia' ? 'ia' : 'oficial') : null, anulada: b.anulada === true,
      comentario: str(b.comentario, 5000), area: ehArea(b.area) ? b.area : null,
      discipline_id: ehUuid(b.discipline_id) ? b.discipline_id : null, topic_id: ehUuid(b.topic_id) ? b.topic_id : null,
      assunto: str(b.assunto, 120), banca: str(b.banca, 60), ano: ano !== null && Number.isInteger(ano) && ano > 1980 && ano < 2100 ? ano : null, fonte: str(b.fonte, 120),
    })
  }
  return { ok: true, questoes: out }
}

// ---------- Filtros e listas ----------

export type Situacao = 'todas' | 'nunca' | 'errei' | 'acertei'
export type Filtros = { area: Area | null; disciplina: string | null; assunto: string | null; topico: string | null; banca: string | null; situacao: Situacao; busca: string }
/** Valor do filtro de assunto que pega as questões SEM assunto. */
export const SEM_ASSUNTO = '(sem assunto)'
export function lerFiltros(sp: Record<string, string | undefined>): Filtros {
  const s = sp.situacao
  return {
    area: lerArea(sp.area), disciplina: ehUuid(sp.disciplina) ? sp.disciplina : null, assunto: str(sp.assunto, 120), topico: ehUuid(sp.topico) ? sp.topico : null, banca: str(sp.banca, 60),
    situacao: s === 'nunca' || s === 'errei' || s === 'acertei' ? s : 'todas', busca: str(sp.busca, 80) ?? '',
  }
}
/** Para links e formulários: só os filtros preenchidos. */
export const filtrosParaUrl = (f: Filtros) =>
  new URLSearchParams(Object.entries({ area: f.area, disciplina: f.disciplina, assunto: f.assunto, topico: f.topico, banca: f.banca, situacao: f.situacao === 'todas' ? null : f.situacao, busca: f.busca || null })
    .filter(([, v]) => v) as [string, string][]).toString()

/** Embaralha (Fisher–Yates) e pega n. `aleatorio` pode ser trocado nos testes. */
export function sortear<T>(xs: T[], n: number, aleatorio: () => number = Math.random): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(aleatorio() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a.slice(0, Math.max(0, n))
}

/** Nome da lista: "Anestesiologia · 10 questões" (ou o assunto, se filtrou por ele). */
export const nomeDaLista = (partes: (string | null | undefined)[], n: number) => `${partes.filter(Boolean).join(' · ') || 'Banco de questões'} · ${n} ${n === 1 ? 'questão' : 'questões'}`

/**
 * Praticar: a próxima questão. Primeiro as que você nunca fez (ao acaso), depois as que errou na última vez (ao acaso), depois as feitas
 * há mais tempo. As já vistas nesta sessão não voltam (o app passa a lista delas).
 */
export function escolherProxima<T extends { id: string; vezes: number; ultimo_certo: boolean | null; ultima_em: string | null }>(cands: T[], aleatorio: () => number = Math.random): T | null {
  if (!cands.length) return null
  const nunca = cands.filter(c => c.vezes === 0)
  if (nunca.length) return sortear(nunca, 1, aleatorio)[0]
  const errei = cands.filter(c => c.ultimo_certo === false)
  if (errei.length) return sortear(errei, 1, aleatorio)[0]
  return [...cands].sort((a, b) => (a.ultima_em ?? '').localeCompare(b.ultima_em ?? ''))[0]
}

// ---------- Assunto pelo texto da questão ----------

const PALAVRAS_VAZIAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'nos', 'nas', 'a', 'o', 'as', 'os', 'com', 'para', 'por', 'sem', 'ao', 'aos', 'um', 'uma', 'ou', 'pelo', 'pela'])
/** As palavras que importam num nome de assunto ("Anestésicos locais" → ["anestesicos", "locais"]). */
const palavras = (s: string) => normalizar(s).split(' ').filter(w => w.length >= 3 && !PALAVRAS_VAZIAS.has(w))
/** A palavra aparece no texto, aceitando singular/plural e pequenas variações no fim ("anestesico" acha "anestesicos"). */
const temPalavra = (texto: string, w: string) => (' ' + texto).includes(' ' + (w.length >= 6 ? w.slice(0, w.length - 2) : w))

/**
 * O assunto (de Matérias → Assuntos) mais provável para uma questão: o que tem TODAS as palavras do nome no enunciado ou nas alternativas.
 * Entre os que servem, fica o de nome mais específico (mais palavras). Sem nenhum, null: a pessoa escolhe.
 */
export function sugerirAssunto<T extends { nome: string }>(textoDaQuestao: string, assuntos: T[]): T | null {
  const t = normalizar(textoDaQuestao)
  let melhor: { a: T; n: number } | null = null
  for (const a of assuntos) {
    const ws = palavras(a.nome)
    if (!ws.length || !ws.every(w => temPalavra(t, w))) continue
    if (!melhor || ws.length > melhor.n || (ws.length === melhor.n && a.nome.length > melhor.a.nome.length)) melhor = { a, n: ws.length }
  }
  return melhor?.a ?? null
}
