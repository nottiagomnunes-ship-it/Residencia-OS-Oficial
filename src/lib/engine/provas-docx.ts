import { unzipSync, strFromU8 } from 'fflate'

/** Um parágrafo do Word: o texto (com quebras de linha manuais) e as figuras que aparecem nele, na ordem, pelo caminho dentro do .docx. */
export type Paragrafo = { texto: string; imagens: string[] }

/** Formatos de figura que qualquer navegador mostra. Os outros (EMF, WMF, TIFF...) viram aviso na prévia. */
export const TIPOS_DE_IMAGEM: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' }
export const extensao = (caminho: string) => (caminho.split('.').pop() ?? '').toLowerCase()
export const tipoDaImagem = (caminho: string): string | null => TIPOS_DE_IMAGEM[extensao(caminho)] ?? null

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
export const decodificar = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m }
    return ENTIDADES[e.toLowerCase()] ?? m
  })

/** Relacionamentos do documento: "rId9" → "word/media/image1.png". Links externos ficam de fora. */
export function lerRelacionamentos(xml: string): Record<string, string> {
  const mapa: Record<string, string> = {}
  for (const m of xml.matchAll(/<Relationship\b([^>]*?)\/?>/g)) {
    const attr = (n: string) => m[1].match(new RegExp(`\\b${n}="([^"]*)"`))?.[1]
    const id = attr('Id'), alvo = attr('Target')
    if (!id || !alvo || attr('TargetMode') === 'External') continue
    mapa[id] = alvo.startsWith('/') ? alvo.slice(1) : 'word/' + alvo.replace(/^\.\//, '')
  }
  return mapa
}

/**
 * O texto do document.xml, parágrafo a parágrafo. Lê texto, tabulação, quebras de linha e figuras (desenhos novos e figuras antigas do tipo VML).
 * Ignora as propriedades do parágrafo (onde ficam as "paradas de tabulação", que não são texto) e o texto apagado com controle de alterações.
 */
export function lerParagrafos(documentXml: string, rels: Record<string, string>): Paragrafo[] {
  const corpo = documentXml.replace(/<w:pPr\b[\s\S]*?<\/w:pPr>/g, '').replace(/<w:del\b[\s\S]*?<\/w:del>/g, '')
  const saida: Paragrafo[] = []
  for (const p of corpo.matchAll(/<w:p\b[^>]*?(?:\/>|>([\s\S]*?)<\/w:p>)/g)) {
    const dentro = p[1] ?? ''
    let texto = ''
    const imagens: string[] = []
    for (const t of dentro.matchAll(/<w:t(?:\s[^>]*?)?(?<!\/)>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/>|<w:(?:br|cr)\b[^>]*\/>|<a:blip\b[^>]*?r:embed="([^"]+)"|<v:imagedata\b[^>]*?r:id="([^"]+)"/g)) {
      if (t[1] !== undefined) texto += decodificar(t[1])
      else if (t[2] || t[3]) { const c = rels[(t[2] || t[3])!]; if (c) imagens.push(c) }
      else if (t[0].startsWith('<w:tab')) texto += ' '
      else texto += '\n'
    }
    saida.push({ texto: texto.replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').trim(), imagens })
  }
  return saida
}

export class ArquivoInvalido extends Error {}

/** Abre o .docx (que é um .zip) e devolve os parágrafos e os bytes das figuras usadas. Funciona no navegador e nos testes. */
export function lerDocx(bytes: Uint8Array): { paragrafos: Paragrafo[]; imagens: Record<string, Uint8Array> } {
  let arquivos: Record<string, Uint8Array>
  try {
    arquivos = unzipSync(bytes, { filter: f => f.name === 'word/document.xml' || f.name === 'word/_rels/document.xml.rels' || f.name.startsWith('word/media/') })
  } catch { throw new ArquivoInvalido('Não consegui abrir o arquivo. Ele precisa ser um documento do Word (.docx); .doc antigo e PDF não funcionam aqui.') }
  const doc = arquivos['word/document.xml']
  if (!doc) throw new ArquivoInvalido('O arquivo não parece ser um documento do Word (.docx).')
  const rels = arquivos['word/_rels/document.xml.rels'] ? lerRelacionamentos(strFromU8(arquivos['word/_rels/document.xml.rels'])) : {}
  const paragrafos = lerParagrafos(strFromU8(doc), rels)
  const usadas = new Set(paragrafos.flatMap(p => p.imagens))
  const imagens = Object.fromEntries(Object.entries(arquivos).filter(([n]) => usadas.has(n)))
  return { paragrafos, imagens }
}
