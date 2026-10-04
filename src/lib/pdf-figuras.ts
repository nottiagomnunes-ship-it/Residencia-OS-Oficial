import { deflateSync } from 'zlib'
import { createHash } from 'crypto'
import { MARCA_FIGURA } from '@/lib/engine/provas-pdf'

/**
 * Texto do PDF com as FIGURAS no lugar (só no servidor). O texto de cada página é montado igual ao `extractText` do unpdf (mesmos trechos e quebras),
 * e cada figura entra como uma linha "MARCA_FIGURA + nome" antes da primeira linha de texto que fica abaixo dela (na mesma faixa horizontal):
 * assim ela cai dentro da questão certa quando as questões são montadas. As figuras saem prontas para guardar (WebP ou PNG).
 * Ficam de fora: figuras pequenas (ícones, marcadores), as que se repetem em 3 ou mais páginas (logotipo, marca d'água) e as que ocupam a página toda.
 */

type M = [number, number, number, number, number, number]
const vezes = (m: M, c: M): M => [m[0] * c[0] + m[1] * c[2], m[0] * c[1] + m[1] * c[3], m[2] * c[0] + m[3] * c[2], m[2] * c[1] + m[3] * c[3],
  m[4] * c[0] + m[5] * c[2] + c[4], m[4] * c[1] + m[5] * c[3] + c[5]]

export type FiguraNoPdf = { pagina: number; chave: string; x0: number; y0: number; x1: number; y1: number }
type Img = { width: number; height: number; data?: Uint8ClampedArray | Uint8Array; kind?: number }
type Linha = { inicio: number; y: number; x0: number; x1: number }

const MIN_LADO = 48, MAX_LARGURA = 1400, MAX_FIGURAS = 150

// ---------- PNG (sem dependência: zlib do Node) ----------
const TABELA_CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc32 = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = TABELA_CRC[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const pedaco = (tipo: string, dados: Buffer) => {
  const t = Buffer.from(tipo, 'ascii'), tam = Buffer.alloc(4), crc = Buffer.alloc(4)
  tam.writeUInt32BE(dados.length); crc.writeUInt32BE(crc32(Buffer.concat([t, dados])))
  return Buffer.concat([tam, t, dados, crc])
}
/** Pixels crus (1, 3 ou 4 canais por pixel) → PNG. */
export function png(largura: number, altura: number, canais: 1 | 3 | 4, px: Uint8Array | Uint8ClampedArray): Buffer {
  const cab = Buffer.alloc(13)
  cab.writeUInt32BE(largura, 0); cab.writeUInt32BE(altura, 4); cab[8] = 8; cab[9] = canais === 1 ? 0 : canais === 3 ? 2 : 6
  const linha = largura * canais, cru = Buffer.alloc((linha + 1) * altura)
  for (let y = 0; y < altura; y++) { cru[y * (linha + 1)] = 0; Buffer.from(px.buffer, px.byteOffset + y * linha, linha).copy(cru, y * (linha + 1) + 1) }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pedaco('IHDR', cab), pedaco('IDAT', deflateSync(cru)), pedaco('IEND', Buffer.alloc(0))])
}
/** Reduz (média de blocos) para no máximo MAX_LARGURA de largura. */
export function reduzir(l: number, a: number, c: number, px: Uint8Array | Uint8ClampedArray) {
  const f = Math.ceil(l / MAX_LARGURA)
  if (f <= 1) return { l, a, px }
  const L = Math.floor(l / f), A = Math.floor(a / f), out = new Uint8Array(L * A * c)
  for (let y = 0; y < A; y++) for (let x = 0; x < L; x++) for (let k = 0; k < c; k++) {
    let s = 0
    for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) s += px[((y * f + dy) * l + (x * f + dx)) * c + k]
    out[(y * L + x) * c + k] = Math.round(s / (f * f))
  }
  return { l: L, a: A, px: out }
}

/** Onde cada figura aparece numa página: percorre os comandos de desenho acompanhando a matriz de transformação. */
export function figurasDosComandos(fns: number[], args: unknown[][], OPS: Record<string, number>, pagina: number): FiguraNoPdf[] {
  let ctm: M = [1, 0, 0, 1, 0, 0]
  const pilha: M[] = [], out: FiguraNoPdf[] = []
  fns.forEach((fn, i) => {
    const a = args[i] ?? []
    if (fn === OPS.save) pilha.push(ctm)
    else if (fn === OPS.restore) ctm = pilha.pop() ?? ctm
    else if (fn === OPS.transform) ctm = vezes(a as unknown as M, ctm)
    else if (fn === OPS.paintFormXObjectBegin) { pilha.push(ctm); if (Array.isArray(a[0]) && a[0].length === 6) ctm = vezes(a[0] as M, ctm) }
    else if (fn === OPS.paintFormXObjectEnd) ctm = pilha.pop() ?? ctm
    else if (fn === OPS.paintImageXObject && typeof a[0] === 'string') {
      const xs = [ctm[4], ctm[0] + ctm[4], ctm[2] + ctm[4], ctm[0] + ctm[2] + ctm[4]], ys = [ctm[5], ctm[1] + ctm[5], ctm[3] + ctm[5], ctm[1] + ctm[3] + ctm[5]]
      out.push({ pagina, chave: a[0], x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) })
    }
  })
  return out
}

/**
 * O texto de uma página (igual ao extractText) com as figuras no lugar. `itens` são os trechos de getTextContent (com a posição em transform),
 * `figuras` as figuras da página já com nome. Cada figura vai antes da primeira linha cuja base fica abaixo do meio dela e que ocupa a mesma
 * faixa horizontal (em prova de duas colunas, a coluna dela); sem nenhuma, no fim da página.
 */
export function textoComFiguras(itens: { str: string; hasEOL?: boolean; transform: number[]; width: number }[], figuras: (FiguraNoPdf & { nome: string })[]) {
  const linhas: Linha[] = []
  itens.forEach((it, i) => {
    const x = it.transform[4], y = it.transform[5]
    if (i === 0 || itens[i - 1].hasEOL) linhas.push({ inicio: i, y, x0: x, x1: x + (it.width || 0) })
    else { const l = linhas[linhas.length - 1]; l.x0 = Math.min(l.x0, x); l.x1 = Math.max(l.x1, x + (it.width || 0)) }
  })
  const antesDe = new Map<number, string[]>(), noFim: string[] = []
  for (const f of [...figuras].sort((a, b) => b.y1 - a.y1 || a.x0 - b.x0)) {
    const meio = (f.y0 + f.y1) / 2
    const abaixo = linhas.filter(l => l.y < meio && l.x1 > f.x0 && l.x0 < f.x1)[0] ?? linhas.filter(l => l.y < meio)[0]
    if (abaixo) antesDe.set(abaixo.inicio, [...(antesDe.get(abaixo.inicio) ?? []), f.nome]); else noFim.push(f.nome)
  }
  let texto = ''
  itens.forEach((it, i) => {
    for (const n of antesDe.get(i) ?? []) texto += `${texto && !texto.endsWith('\n') ? '\n' : ''}${MARCA_FIGURA}${n}\n`
    texto += it.str + (it.hasEOL ? '\n' : '')
  })
  for (const n of noFim) texto += `${texto && !texto.endsWith('\n') ? '\n' : ''}${MARCA_FIGURA}${n}\n`
  return texto
}

export type FiguraPronta = { bytes: Buffer; tipo: 'image/webp' | 'image/png'; ext: 'webp' | 'png' }

/**
 * Pixels → arquivo. Com o sharp (vem com o Next; no Vercel está lá) vira WebP, bem mais leve para foto e exame de imagem;
 * sem ele, PNG feito aqui mesmo. Largura máxima de 1400 px nos dois casos.
 */
export async function codificar(l: number, a: number, c: 1 | 3 | 4, px: Uint8Array | Uint8ClampedArray): Promise<FiguraPronta> {
  try {
    const sharp = (await import('sharp')).default
    const bytes = await sharp(Buffer.from(px.buffer, px.byteOffset, px.byteLength), { raw: { width: l, height: a, channels: c } })
      .resize({ width: MAX_LARGURA, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer()
    return { bytes, tipo: 'image/webp', ext: 'webp' }
  } catch {
    const r = reduzir(l, a, c, px)
    return { bytes: png(r.l, r.a, c, r.px), tipo: 'image/png', ext: 'png' }
  }
}

/** Lê o PDF inteiro: o texto de cada página (com as figuras marcadas) e as figuras prontas para guardar, pelo nome. */
export async function lerPdfComFiguras(dados: Uint8Array): Promise<{ paginas: string[]; figuras: Record<string, FiguraPronta> }> {
  const { getDocumentProxy, getResolvedPDFJS } = await import('unpdf')
  const pdf = await getDocumentProxy(dados)
  const { OPS } = await getResolvedPDFJS() as unknown as { OPS: Record<string, number> }
  const porPagina: { itens: any[]; figs: FiguraNoPdf[]; largura: number; altura: number; page: any }[] = []
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n)
    const [conteudo, ops] = await Promise.all([page.getTextContent(), page.getOperatorList()])
    const [, , largura, altura] = page.view
    porPagina.push({ itens: conteudo.items.filter((i: any) => i.str != null), figs: figurasDosComandos(ops.fnArray, ops.argsArray, OPS, n), largura, altura, page })
  }
  // carrega as figuras (pixels) e descarta as que não são da questão
  type Carregada = FiguraNoPdf & { img: Img; canais: 1 | 3 | 4; marca: string }
  const carregadas: Carregada[][] = []
  for (const p of porPagina) {
    const da: Carregada[] = []
    for (const f of p.figs) {
      if ((f.x1 - f.x0) * (f.y1 - f.y0) > 0.85 * p.largura * p.altura) continue // fundo da página / página escaneada
      const centro = (f.y0 + f.y1) / 2
      if (centro > p.altura * 0.92 || centro < p.altura * 0.06) continue // cabeçalho e rodapé (logotipo da instituição)
      const img = await new Promise<Img | null>(ok => { try { (f.chave.startsWith('g_') ? p.page.commonObjs : p.page.objs).get(f.chave, ok) } catch { ok(null) } })
      if (!img?.data || img.width < MIN_LADO || img.height < MIN_LADO) continue
      const canais = img.data.length / (img.width * img.height)
      if (canais !== 1 && canais !== 3 && canais !== 4) continue // 1 bit por pixel (preto e branco compactado): fica de fora
      da.push({ ...f, img, canais, marca: createHash('sha1').update(img.data).digest('hex') })
    }
    carregadas.push(da)
  }
  // logotipo / marca d'água: a mesma figura (os mesmos pixels) em 3 ou mais páginas
  const paginasDa = new Map<string, Set<number>>()
  for (const da of carregadas) for (const f of da) paginasDa.set(f.marca, (paginasDa.get(f.marca) ?? new Set()).add(f.pagina))
  const figuras: Record<string, FiguraPronta> = {}, paginas: string[] = []
  let total = 0
  for (const [k, p] of porPagina.entries()) {
    const nomeadas: (FiguraNoPdf & { nome: string })[] = []
    for (const f of carregadas[k]) {
      if ((paginasDa.get(f.marca)?.size ?? 0) >= 3 || total >= MAX_FIGURAS) continue
      const nome = `pdf-p${f.pagina}-${++total}`
      figuras[nome] = await codificar(f.img.width, f.img.height, f.canais, f.img.data!)
      nomeadas.push({ ...f, nome })
    }
    paginas.push(textoComFiguras(p.itens, nomeadas))
  }
  return { paginas, figuras }
}
