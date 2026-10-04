import type { Paragrafo } from './provas-docx'
import type { QuestaoLida } from './provas'

const RODAPE = /\s*\b\d{1,3} de \d{1,3}$/                      // "1 de 26" no fim da página (às vezes colado na última linha)
const QUESTAO = /^QUEST[ÃãAa][OoÕõ]\s*(?:N[º°o]?\.?\s*)?\d{1,3}\b/i
const ALTERNATIVA = /^\(?[A-Ea-e]\s*[)\].\-–—]\s/
const GABARITO = /^GABARITO\b/i
/** Linha que marca uma figura no texto do PDF (posta pelo leitor do servidor): "MARCA_FIGURA + nome da figura". */
export const MARCA_FIGURA = '\uE000FIGURA:'
// "UFMA 2018 ACESSO DIRETO", "SUS-BA 2019 ACESSO DIRETO", "INEP 2015 REVALIDA": maiúsculas, com um ano no meio
export const ORIGEM = /^(?:([A-ZÀ-Ú0-9][A-ZÀ-Ú0-9 .\/()&'-]{0,60}?)\s+)?((?:19|20)\d{2})\b\s*([A-ZÀ-Ú0-9 .\/()-]{0,60})$/

/**
 * Texto do PDF (uma string por página, na ordem de leitura) → parágrafos para montar as questões. As quebras de linha do PDF são só da diagramação:
 * as linhas de um mesmo trecho são juntadas. Começa um parágrafo novo em "Questão N", na linha de origem (banca e ano), em cada alternativa
 * e no título "Gabarito"; depois do gabarito, cada linha fica separada (é uma tabela). O rodapé "N de M" de cada página é retirado.
 */
export function paragrafosDoPdf(paginas: string[]): Paragrafo[] {
  const linhas: string[] = []
  for (const p of paginas) {
    const ls = p.split('\n').map(l => l.trim()).filter(Boolean)
    const ult = ls.findLastIndex(l => !l.startsWith(MARCA_FIGURA)) // o rodapé está na última linha de texto (uma figura pode vir depois)
    if (ult >= 0) ls[ult] = ls[ult].replace(RODAPE, '').trim()
    linhas.push(...ls.filter(Boolean))
  }
  const out: Paragrafo[] = []
  let noGabarito = false, comeca = true // comeca = a próxima linha abre um parágrafo novo
  for (const l of linhas) {
    if (l.startsWith(MARCA_FIGURA)) { // figura: um parágrafo só dela; o texto depois começa outro
      if (!noGabarito) { out.push({ texto: '', imagens: [l.slice(MARCA_FIGURA.length)] }); comeca = true }
      continue
    }
    if (noGabarito) { out.push({ texto: l, imagens: [] }); continue }
    if (GABARITO.test(l)) { noGabarito = true; out.push({ texto: l, imagens: [] }); continue }
    const anterior = [...out].reverse().find(p => p.texto)
    const titulo = QUESTAO.test(l), origem = !titulo && !!anterior && QUESTAO.test(anterior.texto) && ORIGEM.test(l)
    if (comeca || titulo || origem || ALTERNATIVA.test(l)) out.push({ texto: l, imagens: [] })
    else { const ult = out[out.length - 1]; ult.texto = ult.texto.endsWith('-') ? ult.texto + l : `${ult.texto} ${l}` }
    comeca = titulo || origem // depois do título e da linha de origem, o enunciado começa num parágrafo próprio
  }
  return out.filter(p => p.texto || p.imagens.length)
}

/** Separa "UFMA 2018 ACESSO DIRETO" do enunciado: banca, ano e o tipo de prova (quando houver). Funciona também para .docx nesse formato. */
export function extrairOrigem(q: QuestaoLida): { questao: QuestaoLida; banca: string | null; ano: number | null; tipo: string | null } {
  const k = q.blocos.findIndex(b => b.tipo === 'texto') // o primeiro trecho de texto (uma figura do PDF pode vir antes dele)
  const b = q.blocos[k]
  const m = b?.tipo === 'texto' ? b.texto.match(ORIGEM) : null
  if (!m || q.blocos.length < 2) return { questao: q, banca: null, ano: null, tipo: null }
  return { questao: { ...q, blocos: q.blocos.filter((_, i) => i !== k) }, banca: m[1]?.trim() || null, ano: Number(m[2]), tipo: m[3].trim() || null }
}

/** Questões que parecem depender de uma figura (para avisar quando o PDF não trouxe nenhuma figura para ela). */
export const pareceTerFigura = (q: QuestaoLida) =>
  /\b(imagem|figura|gr[aá]fico|foto(grafia)?|radiografia mostrada|ilustra[cç][aã]o|observe (a|o)|abaixo:?\s*$)\b/i.test(q.blocos.map(b => (b.tipo === 'texto' ? b.texto : '')).join(' '))
