import { addDays } from './review'

export type ItemImportado = { disciplina: string; subcategoria: string | null; nome: string; data: string | null; grupo: string | null }
export const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

const DATA = String.raw`(\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2}(?:/\d{2,4})?)`
const SEMANA = String.raw`(?:(?:seg|ter|qua|qui|sex|s[áa]b|dom)[a-zç-]*\.?,?\s+)?`
const INICIO = new RegExp(`^${SEMANA}${DATA}\\s*[-–:;|]?\\s*(.+)$`, 'i')   // "05/10 Hipertensão", "Seg 05/10: Hipertensão"
const FIM = new RegExp(`^(.+?)\\s*[-–;|@(]\\s*${DATA}\\)?\\s*$`)            // "Hipertensão - 05/10", "Hipertensão (05/10)"
const ymd = (y: number, m: number, d: number) => `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

/** Converte "05/10", "05/10/26" ou "2026-10-05" em ISO. Sem ano, usa o ano da data de referência (ou o seguinte, se já passou há mais de 60 dias). */
function paraIso(t: string, hoje: string) {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t)
  let y: number, m: number, d: number
  if (iso) { y = +iso[1]; m = +iso[2]; d = +iso[3] }
  else {
    const p = t.split('/').map(Number); d = p[0]; m = p[1]; y = p[2] ? (p[2] < 100 ? 2000 + p[2] : p[2]) : +hoje.slice(0, 4)
    if (!p[2] && ymd(y, m, d) < addDays(hoje, -60)) y++
  }
  const r = ymd(y, m, d), dt = new Date(r + 'T00:00:00Z')
  return dt.getUTCFullYear() === y && dt.getUTCMonth() + 1 === m && dt.getUTCDate() === d ? r : null
}
function separar(linha: string, hoje: string) {
  let m = INICIO.exec(linha), tx = m?.[1], nome = m?.[2]
  if (!m) { m = FIM.exec(linha); nome = m?.[1]; tx = m?.[2] }
  if (!m) return { nome: linha, data: null as string | null, invalida: false }
  const data = paraIso(tx!, hoje)
  return data ? { nome: nome!.trim(), data, invalida: false } : { nome: linha, data: null, invalida: true }
}
const titulo = (s: string) => s.toLowerCase().replace(/(^|\s)([a-zà-ý])/g, (_, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Das|Dos|E)\b/g, x => x.toLowerCase())
const limpar = (l: string) => l.replace(/^\s*(?:[-•*–]\s+|\d+[.)]\s+)/, '').trim()

// "Semana 1", "Dia 3", "Bloco 2"...: só definem a ORDEM de estudo, não são disciplinas
const PALAVRAS = String.raw`(?:semana|sem\.?|dia|bloco|etapa|fase|m[eê]s|m[óo]dulo|rodada|ciclo)`
const PERIODO = new RegExp(String.raw`^(?:${PALAVRAS}\s*\d+|\d+\s*[ªa°º.]?\s*${PALAVRAS})`, 'i')
const PERIODO_SOLTO = new RegExp(String.raw`^${PALAVRAS}\s*\d+\s*[:\-–]?\s*$`, 'i')
const rotulo = (t: string) => (t === t.toUpperCase() && /[A-ZÀ-Ý]/.test(t) ? titulo(t) : t)

/**
 * Lê um cronograma em texto. Formatos aceitos (podem ser misturados):
 *   # Disciplina / ## Subcategoria / linhas de assuntos (um por linha)
 *   Disciplina > Subcategoria > Assunto   (ou Disciplina > Assunto)
 * Título de disciplina também pode ser uma linha TODA EM MAIÚSCULAS ou terminada em ":".
 * Data opcional no início ou no fim da linha: "05/10 Assunto", "Assunto - 05/10", "Assunto (2026-10-05)".
 */
export function parseCronograma(texto: string, hoje: string) {
  const itens: ItemImportado[] = [], avisos: string[] = [], semDisc: string[] = [], vistos = new Set<string>()
  let disc: string | null = null, sub: string | null = null, grupo: string | null = null, repetidos = 0
  texto.split(/\r?\n/).forEach((bruta, i) => {
    const linha = bruta.trim(); if (!linha) return
    const h = /^(#{1,3})\s*(.+?)\s*:?\s*$/.exec(linha)
    const caps = /^[A-ZÀ-Ý][A-ZÀ-Ý\s/&,.-]{2,59}$/.test(linha) && /[A-ZÀ-Ý]{3}/.test(linha) && (linha.length >= 7 || /\s/.test(linha)) // siglas (DPOC, TEP) são assuntos
    if (h || caps || PERIODO_SOLTO.test(linha) || /^[^>\d]{1,80}:$/.test(linha)) {
      let t = h ? h[2] : linha.replace(/\s*:\s*$/, '').trim()
      if (caps && !h) t = titulo(t)
      if (PERIODO.test(t)) { grupo = rotulo(t); disc = null; sub = null; return }
      const nivel = h ? h[1].length : 1
      // com uma semana ativa, "##" é a disciplina e "###" a subcategoria; sem semana, "#" é a disciplina e "##" a subcategoria
      if (nivel === 1 || (nivel === 2 && grupo != null)) { disc = t; sub = null } else sub = t
      return
    }
    const l = limpar(linha)
    let d = disc, s = sub, bruto = l
    if (l.includes('>')) {
      const p = l.split('>').map(x => x.trim()).filter(Boolean)
      if (p.length < 2) return
      d = p[0]; s = p.length >= 3 ? p[1] : null; bruto = p.slice(p.length >= 3 ? 2 : 1).join(' - ')
    }
    const { nome, data, invalida } = separar(bruto, hoje)
    if (invalida) avisos.push(`Linha ${i + 1}: data inválida em "${l}". Importada sem data.`)
    if (!nome || /^[\d/\-\s]+$/.test(nome)) return
    if (!d) { semDisc.push(nome); return }
    if (nome.length > 160) { avisos.push(`Linha ${i + 1}: texto longo demais, ignorada.`); return }
    const chave = `${norm(d)}|${norm(nome)}`
    if (vistos.has(chave)) { repetidos++; return }
    vistos.add(chave); itens.push({ disciplina: d, subcategoria: s, nome, data, grupo })
  })
  if (semDisc.length) avisos.unshift(`${semDisc.length} linhas sem disciplina foram ignoradas (ex.: "${semDisc[0]}"). Coloque o nome da disciplina com # (ou ## dentro de uma semana) antes delas.`)
  if (repetidos) avisos.push(`${repetidos} linhas repetidas foram ignoradas.`)
  return { itens, avisos }
}
