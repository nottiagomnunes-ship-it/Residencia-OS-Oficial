import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { inflateSync } from 'zlib'
import { lerPdfComFiguras, textoComFiguras, figurasDosComandos, png, reduzir, codificar } from './pdf-figuras'
import { paragrafosDoPdf, MARCA_FIGURA } from './engine/provas-pdf'
import { montarQuestoes, lerGabarito } from './engine/provas'
import { itensDeQuestoes, textoParaHash } from './engine/banco'

// prova-com-figuras.pdf (gerado para o teste): 3 páginas com logotipo no cabeçalho de todas; Q1 com um ECG no meio do enunciado,
// Q2 sem figura, Q3 com uma radiografia (JPEG) e a página do gabarito
describe('figuras do PDF', () => {
  it('PDF de verdade: cada figura entra na questão certa, no lugar certo; logotipo do cabeçalho fica de fora; o texto não muda', async () => {
    const r = await lerPdfComFiguras(new Uint8Array(readFileSync('src/lib/__fixtures__/prova-com-figuras.pdf')))
    expect(Object.keys(r.figuras)).toEqual(['pdf-p1-1', 'pdf-p2-2'])
    for (const f of Object.values(r.figuras)) expect(f.bytes.length).toBeGreaterThan(100)
    const prova = montarQuestoes(paragrafosDoPdf(r.paginas))
    const itens = itensDeQuestoes(prova.questoes, lerGabarito(prova.gabaritoTexto ?? '', prova.questoes.map(q => q.numero)).respostas)
    expect(prova.avisos).toEqual([])
    expect(itens.map(i => [i.questao.numero, i.banca, i.ano, i.gabarito, i.questao.alternativas.length])).toEqual([[1, 'UFMA', 2020, 'A', 4], [2, 'UFMA', 2020, 'A', 4], [3, 'UFMA', 2021, 'C', 4]])
    expect(itens[0].questao.blocos).toEqual([
      { tipo: 'texto', texto: 'Paciente de 60 anos com palpitações. Observe o ECG abaixo:' }, { tipo: 'imagem', caminho: 'pdf-p1-1' }, { tipo: 'texto', texto: 'Qual o diagnóstico?' }])
    expect(itens[1].questao.blocos.some(b => b.tipo === 'imagem')).toBe(false)
    expect(itens[2].questao.blocos.map(b => b.tipo)).toEqual(['texto', 'imagem', 'texto'])
    // a impressão digital é a mesma de quando o PDF era lido só como texto: importar de novo não duplica (e a questão ganha a figura)
    const { extractText, getDocumentProxy } = await import('unpdf')
    const { text } = await extractText(await getDocumentProxy(new Uint8Array(readFileSync('src/lib/__fixtures__/prova-com-figuras.pdf'))), { mergePages: false })
    const antes = montarQuestoes(paragrafosDoPdf(text as string[])).questoes, itensAntes = itensDeQuestoes(antes, new Map())
    expect(itens.map(i => textoParaHash(i.questao.blocos, i.questao.alternativas))).toEqual(itensAntes.map(i => textoParaHash(i.questao.blocos, i.questao.alternativas)))
    // sem as marcas de figura, o texto é o mesmo de antes (a impressão digital das questões já importadas não muda)
    expect(r.paginas[1].split('\n').filter(l => !l.startsWith(MARCA_FIGURA)).join('\n')).toBe('QUESTÃO 3\nUFMA 2021 ACESSO DIRETO\nRadiografia de tórax mostrada a seguir.\nO achado é compatível com:\nA) Derrame pleural\nB) Pneumotórax\nC) Cardiomegalia\nD) Normal\n2 de 3')
  })
  it('lugar da figura: depois da última linha acima dela na mesma coluna; sem nenhuma acima, antes da primeira abaixo; sem nada, no fim', () => {
    const it = (str: string, x: number, y: number, w = 400) => ({ str, hasEOL: true, transform: [1, 0, 0, 1, x, y], width: w })
    const itens = [it('Coluna 1 topo', 40, 700, 200), it('Coluna 1 meio', 40, 400, 200), it('Coluna 2 topo', 320, 700, 200), it('Coluna 2 baixo', 320, 300, 200)]
    const fig = (nome: string, x0: number, y0: number, x1: number, y1: number) => ({ nome, pagina: 1, chave: nome, x0, y0, x1, y1 })
    // a: meio da coluna 2; z: pé da coluna 1 (depois da última linha da coluna 1, e não no fim da página); t: topo da coluna 2; s: fora das colunas
    const t = textoComFiguras(itens, [fig('a', 330, 450, 500, 650), fig('z', 40, 10, 200, 60), fig('t', 330, 720, 500, 800), fig('s', 560, 100, 590, 200)])
    expect(t.split('\n')).toEqual(['Coluna 1 topo', 'Coluna 1 meio', `${MARCA_FIGURA}z`, `${MARCA_FIGURA}t`, 'Coluna 2 topo', `${MARCA_FIGURA}a`, 'Coluna 2 baixo', `${MARCA_FIGURA}s`, ''])
  })
  it('PDF que junta numa "linha" trechos das duas colunas: a linha é separada pela altura', () => {
    // a figura da coluna 2 (embaixo) não pode cair no meio do texto da coluna 1 só porque o PDF não marcou o fim da linha
    const itens = [{ str: 'Esquerda alto', hasEOL: false, transform: [1, 0, 0, 1, 40, 500], width: 200 }, { str: ' direita mais baixo', hasEOL: true, transform: [1, 0, 0, 1, 320, 300], width: 200 },
      { str: 'Esquerda baixo', hasEOL: true, transform: [1, 0, 0, 1, 40, 100], width: 200 }]
    const t = textoComFiguras(itens, [{ nome: 'f', pagina: 1, chave: 'f', x0: 330, y0: 150, x1: 500, y1: 250 }])
    expect(t.split('\n')).toEqual(['Esquerda alto direita mais baixo', `${MARCA_FIGURA}f`, 'Esquerda baixo', ''])
  })
  it('posição pela matriz de transformação (com save/restore e formulários)', () => {
    const OPS = { save: 1, restore: 2, transform: 3, paintImageXObject: 4, paintFormXObjectBegin: 5, paintFormXObjectEnd: 6 }
    const f = figurasDosComandos([1, 3, 4, 2, 5, 3, 4, 6], [[], [200, 0, 0, 100, 50, 300], ['img1'], [], [[1, 0, 0, 1, 10, 10], null], [50, 0, 0, 50, 0, 0], ['img2'], []], OPS, 2)
    expect(f).toEqual([{ pagina: 2, chave: 'img1', x0: 50, y0: 300, x1: 250, y1: 400 }, { pagina: 2, chave: 'img2', x0: 10, y0: 10, x1: 60, y1: 60 }])
  })
  it('PNG válido (cinza, RGB e com transparência) e figura grande reduzida', () => {
    for (const c of [1, 3, 4] as const) {
      const b = png(2, 2, c, new Uint8Array(4 * c).fill(200))
      expect(b.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      const idat = b.indexOf('IDAT'), tam = b.readUInt32BE(idat - 4)
      expect(inflateSync(b.subarray(idat + 4, idat + 4 + tam)).length).toBe(2 * (2 * c + 1))
    }
    const r = reduzir(3000, 10, 1, new Uint8Array(30000).fill(9))
    expect(r.l).toBe(1000)
    expect([r.l, r.a, r.px.length, r.px[0]]).toEqual([1000, 3, 3000, 9])
  })
})

describe('parágrafos do PDF com figuras', () => {
  it('a figura vira um parágrafo próprio; o rodapé sai mesmo com figura no fim da página; no gabarito, marcas são ignoradas', () => {
    const ps = paragrafosDoPdf([`QUESTÃO 1\nVeja:\n${MARCA_FIGURA}f1.png\ncontinua\nA) a\nB) b\n12 de 30\n${MARCA_FIGURA}f2.png`, `GABARITO\n${MARCA_FIGURA}f3.png\n1 - A`])
    expect(ps).toEqual([{ texto: 'QUESTÃO 1', imagens: [] }, { texto: 'Veja:', imagens: [] }, { texto: '', imagens: ['f1.png'] }, { texto: 'continua', imagens: [] },
      { texto: 'A) a', imagens: [] }, { texto: 'B) b', imagens: [] }, { texto: '', imagens: ['f2.png'] }, { texto: 'GABARITO', imagens: [] }, { texto: '1 - A', imagens: [] }])
  })
  it('figura entre o título e a linha da banca não atrapalha achar banca e ano', () => {
    const p = montarQuestoes(paragrafosDoPdf([`QUESTÃO 1\n${MARCA_FIGURA}f.png\nUFMA 2019 ACESSO DIRETO\nEnunciado\nA) a\nB) b`]))
    const [i] = itensDeQuestoes(p.questoes, new Map())
    expect([i.banca, i.ano]).toEqual(['UFMA', 2019])
  })
})

describe('guardar a figura', () => {
  it('vira WebP (com o sharp) com no máximo 1400 px de largura', async () => {
    const f = await codificar(2800, 100, 3, new Uint8Array(2800 * 100 * 3).fill(120))
    expect(f.tipo).toBe('image/webp'); expect(f.bytes.subarray(8, 12).toString()).toBe('WEBP')
    const sharp = (await import('sharp')).default
    expect((await sharp(f.bytes).metadata()).width).toBe(1400)
  })
})
