import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { paragrafosDoPdf, extrairOrigem, pareceTerFigura } from './provas-pdf'
import { montarQuestoes, lerGabarito, textoDosBlocos, ehCertoErrado } from './provas'
import { lerPacote, itensDeQuestoes, validarLote, textoParaHash, lerFiltros, filtrosParaUrl, sortear, nomeDaLista } from './banco'

const fx = (n: string) => path.join(__dirname, '__fixtures__', n)
// o texto que o servidor extrai do PDF (unpdf), página por página: gerado uma vez a partir dos PDFs de exemplo
async function paginas(arquivo: string) {
  const { extractText, getDocumentProxy } = await import('unpdf')
  const pdf = await getDocumentProxy(new Uint8Array(readFileSync(fx(arquivo))))
  const { text } = await extractText(pdf, { mergePages: false })
  return text as string[]
}

describe('PDF de questões (formato "Questão N" + banca/ano + "A." + Gabarito em tabela)', () => {
  const tem = existsSync(fx('anestesiologia_1.pdf')) && existsSync(fx('anestesiologia_2.pdf'))
  it.skipIf(!tem)('os dois PDFs de anestesiologia: 120 questões cada, gabarito da tabela, anuladas, banca e ano', async () => {
    const lote = async (a: string) => {
      const prova = montarQuestoes(paragrafosDoPdf(await paginas(a)))
      const g = lerGabarito(prova.gabaritoTexto ?? '', prova.questoes.map(q => q.numero))
      return { prova, g, itens: itensDeQuestoes(prova.questoes, g.respostas) }
    }
    const a = await lote('anestesiologia_1.pdf'), b = await lote('anestesiologia_2.pdf')
    for (const x of [a, b]) {
      expect(x.prova.questoes.map(q => q.numero)).toEqual(Array.from({ length: 120 }, (_, i) => i + 1))
      expect(x.prova.avisos).toEqual([])
      expect(x.itens.every(i => i.questao.alternativas.length >= 2 && i.questao.blocos.length >= 1)).toBe(true)
      expect(x.itens.some(i => /\d+ de 2\d/.test(textoDosBlocos(i.questao.blocos) + i.questao.alternativas.map(q => q.texto).join(' ')) && /\b\d{1,2} de 2[67]\s*$/.test(textoDosBlocos(i.questao.blocos)))).toBe(false) // rodapé fora
    }
    // arquivo 1: 111 com gabarito; "-" na tabela = sem resposta (são exatamente as questões marcadas "Anulada" no título)
    expect(a.g.respostas.size).toBe(111); expect(a.g.semResposta).toEqual([17, 23, 46, 53, 61, 74, 89, 97, 116])
    expect(a.itens.filter(i => i.anulada).map(i => i.questao.numero)).toEqual(a.g.semResposta)
    expect(b.g.respostas.size).toBe(113); expect(b.g.semResposta).toHaveLength(7)
    const q1 = a.itens[0]
    expect(q1).toMatchObject({ banca: 'UFMA', ano: 2018, gabarito: 'C', gabarito_origem: 'oficial', anulada: false })
    expect(textoDosBlocos(q1.questao.blocos)).toMatch(/^Paciente com 32 anos de idade, masculino, com proposta de realização de gastroplastia/)
    expect(q1.questao.alternativas[1].texto).toBe('P2, devido ao antecedente de refluxo gastroesofágico.')
    expect(a.itens[119]).toMatchObject({ banca: 'UNICAMP', ano: 2016, gabarito: 'B' })
    expect(a.itens.filter(i => !i.banca).map(i => [i.questao.numero, i.ano])).toEqual([[53, 2026]])        // "2026 ACESSO DIRETO", sem banca
    expect(a.itens.filter(i => ehCertoErrado(i.questao.alternativas)).length).toBeGreaterThan(0)             // "julgue o item": Certo/Errado
    expect(a.itens.map(i => i.questao).filter(pareceTerFigura).map(q => q.numero)).toEqual([39, 57, 106])
    // os dois arquivos têm questões em comum: a "impressão digital" reconhece as repetidas
    const ha = new Set(a.itens.map(i => textoParaHash(i.questao.blocos, i.questao.alternativas)))
    const comuns = b.itens.filter(i => ha.has(textoParaHash(i.questao.blocos, i.questao.alternativas))).length
    expect(comuns).toBeGreaterThan(30); expect(comuns).toBeLessThan(120)
  }, 30000)

  it('linhas soltas viram parágrafos; rodapé "N de M" sai mesmo colado na última linha', () => {
    const ps = paragrafosDoPdf(['Questão 01\nUFMA 2018 ACESSO DIRETO\nPaciente com\ndor torá-\ncica. Qual a conduta?\nA. Primeira\nalternativa.\nB. Segunda. 1 de 26', 'Questão 02 Anulada\n2026 ACESSO DIRETO\nTexto\nA. a\nB. b\nGabarito\n1 2\nC -'])
    expect(ps.map(p => p.texto)).toEqual(['Questão 01', 'UFMA 2018 ACESSO DIRETO', 'Paciente com dor torá-cica. Qual a conduta?', 'A. Primeira alternativa.', 'B. Segunda.',
      'Questão 02 Anulada', '2026 ACESSO DIRETO', 'Texto', 'A. a', 'B. b', 'Gabarito', '1 2', 'C -'])
    const r = montarQuestoes(ps)
    expect(r.questoes[1].anulada).toBe(true)
    expect(extrairOrigem(r.questoes[0])).toMatchObject({ banca: 'UFMA', ano: 2018, tipo: 'ACESSO DIRETO' })
    const g = lerGabarito(r.gabaritoTexto!, [1, 2]); expect([...g.respostas]).toEqual([[1, 'C']]); expect(g.semResposta).toEqual([2])
  })
  it('gabarito em tabela ignora título e data; pares "1 - B" continuam funcionando', () => {
    const g = lerGabarito('anestesiologia\n03 de Outubro de 2026\n1 2 3 4\nC - A B\n5 6\nE D', [1, 2, 3, 4, 5, 6])
    expect([...g.respostas]).toEqual([[1, 'C'], [3, 'A'], [4, 'B'], [5, 'E'], [6, 'D']]); expect(g.semResposta).toEqual([2])
    expect([...lerGabarito('1 - B\n2 - C', [1, 2]).respostas]).toEqual([[1, 'B'], [2, 'C']])
  })
})

describe('pacote .json', () => {
  it('lê enunciado (texto ou partes com figura), alternativas em texto ou objeto, gabarito e origem do gabarito; avisa o que falta', () => {
    const p = lerPacote({ fonte: 'Lote 1', disciplina: 'Anestesiologia', imagens: { 'f.png': 'data:image/png;base64,iVBORw0KGgo=', 'x.svg': 'data:image/svg+xml;base64,AAA' },
      questoes: [
        { enunciado: ['Veja', { imagem: 'f.png' }, { imagem: 'nao-existe.png' }], alternativas: ['um', 'dois'], gabarito: 'b', gabarito_origem: 'ia', assunto: 'Via aérea', banca: 'UFMA', ano: 2018, comentario: 'Porque sim.' },
        { enunciado: 'Só texto', alternativas: [{ letra: 'A', texto: 'a' }, { texto: 'b' }, { texto: 'c' }], gabarito: 'E' },
        { enunciado: 'Sem alternativas', alternativas: ['x'] },
        { enunciado: 'Anulada', alternativas: ['a', 'b'], gabarito: 'X' },
      ] })
    expect(p.fonte).toBe('Lote 1'); expect(p.disciplina).toBe('Anestesiologia'); expect(Object.keys(p.imagens)).toEqual(['f.png'])
    expect(p.itens).toHaveLength(3)
    expect(p.itens[0]).toMatchObject({ gabarito: 'B', gabarito_origem: 'ia', assunto: 'Via aérea', banca: 'UFMA', ano: 2018, comentario: 'Porque sim.' })
    expect(p.itens[0].questao.blocos).toEqual([{ tipo: 'texto', texto: 'Veja' }, { tipo: 'imagem', caminho: 'f.png' }])
    expect(p.itens[1]).toMatchObject({ gabarito: null, gabarito_origem: null }); expect(p.itens[1].questao.alternativas.map(a => a.letra)).toEqual(['A', 'B', 'C'])
    expect(p.itens[2]).toMatchObject({ anulada: true, gabarito: null })
    expect(p.avisos).toEqual(['Questão 1: a figura "nao-existe.png" não está no pacote.', 'Questão 2: gabarito "E" não é uma das alternativas.', 'Questão 3: sem enunciado ou com menos de 2 alternativas; foi ignorada.'])
    expect(lerPacote({ x: 1 }).avisos[0]).toMatch(/questoes/)
  })
})

describe('conferência no servidor', () => {
  const uid = '11111111-1111-1111-1111-111111111111'
  const q = (o: object = {}) => ({ blocos: [{ tipo: 'texto', texto: ' x ' }], alternativas: [{ letra: 'A', texto: 'a' }, { letra: 'B', texto: 'b' }], gabarito: 'B', gabarito_origem: 'ia', ...o })
  it('aceita, limpa e recusa o que não deve entrar', () => {
    const r = validarLote({ questoes: [q({ area: 'go', discipline_id: 'x', ano: '2018', blocos: [{ tipo: 'texto', texto: 'y' }, { tipo: 'imagem', caminho: `${uid}/banco/a.png` }] })] }, uid)
    expect(r.ok && r.questoes[0]).toMatchObject({ gabarito: 'B', gabarito_origem: 'ia', area: 'go', discipline_id: null, ano: 2018 })
    const erro = (v: unknown) => { const x = validarLote(v, uid); return x.ok ? null : x.erro }
    expect(erro({ questoes: [] })).toMatch(/Nenhuma/)
    expect(erro({ questoes: [q({ blocos: [{ tipo: 'imagem', caminho: `outra/banco/a.png` }] })] })).toMatch(/figura/)
    expect(erro({ questoes: [q({ blocos: [{ tipo: 'imagem', caminho: `${uid}/outra-prova/a.png` }] })] })).toMatch(/figura/)
    expect(erro({ questoes: [q({ gabarito: 'D' })] })).toMatch(/gabarito/)
    expect(erro({ questoes: Array(1001).fill(q()) })).toMatch(/1000/)
  })
  it('a impressão digital ignora acento, maiúsculas, espaços e pontuação (e as figuras)', () => {
    const a = textoParaHash([{ tipo: 'texto', texto: 'Qual a conduta?' }], [{ letra: 'A', texto: 'Intubação.' }])
    expect(textoParaHash([{ tipo: 'texto', texto: 'QUAL  a conduta' }, { tipo: 'imagem', caminho: 'x' }], [{ letra: 'A', texto: 'intubacao' }])).toBe(a)
    expect(textoParaHash([{ tipo: 'texto', texto: 'Qual a conduta?' }], [{ letra: 'A', texto: 'Extubação.' }])).not.toBe(a)
  })
})

describe('filtros e listas', () => {
  it('filtros vindos da URL são conferidos; a URL leva só o que está preenchido', () => {
    const f = lerFiltros({ area: 'cirurgia', disciplina: 'nao-e-uuid', situacao: 'errei', banca: ' UFMA ' })
    expect(f).toEqual({ area: 'cirurgia', disciplina: null, assunto: null, topico: null, banca: 'UFMA', situacao: 'errei', busca: '', anoDe: null, anoAte: null, revisao: false, tema: null, questao: null })
    expect(filtrosParaUrl(f)).toBe('area=cirurgia&banca=UFMA&situacao=errei')
    expect(lerFiltros({ area: 'x', situacao: 'y' })).toMatchObject({ area: null, situacao: 'todas' })
  })
  it('ano da prova: de/até conferidos, trocados se vierem invertidos, e rótulo para títulos', () => {
    expect(lerFiltros({ de: '2024', ate: '2020' })).toMatchObject({ anoDe: 2020, anoAte: 2024 })
    expect(lerFiltros({ de: '20', ate: 'abc' })).toMatchObject({ anoDe: null, anoAte: null })
    expect(filtrosParaUrl(lerFiltros({ banca: 'UFMA', de: '2020' }))).toBe('banca=UFMA&de=2020')
    expect(rotuloDosAnos({ anoDe: 2020, anoAte: 2024 })).toBe('2020–2024'); expect(rotuloDosAnos({ anoDe: 2022, anoAte: 2022 })).toBe('2022')
    expect(rotuloDosAnos({ anoDe: 2020, anoAte: null })).toBe('desde 2020'); expect(rotuloDosAnos({ anoDe: null, anoAte: 2018 })).toBe('até 2018')
    expect(rotuloDosAnos({ anoDe: null, anoAte: null })).toBeNull()
  })
  it('tema da lista geral vem no campo assunto como "tema:<id>" e volta igual na URL', () => {
    const id = '7e000000-0000-0000-0000-000000000001'
    expect(lerFiltros({ assunto: `tema:${id}` })).toMatchObject({ tema: id, assunto: null })
    expect(filtrosParaUrl(lerFiltros({ assunto: `tema:${id}` }))).toBe(`assunto=tema%3A${id}`)
    expect(lerFiltros({ assunto: 'tema:lixo' })).toMatchObject({ tema: null, assunto: null })
  })
  it('sorteio sem repetir e no tamanho pedido; nome da lista', () => {
    let s = 1; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    const r = sortear([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 4, rnd)
    expect(r).toHaveLength(4); expect(new Set(r).size).toBe(4); expect(sortear([1, 2], 5)).toHaveLength(2)
    expect(nomeDaLista(['Anestesiologia', null, 'UFMA'], 10)).toBe('Anestesiologia · UFMA · 10 questões'); expect(nomeDaLista([], 1)).toBe('Banco de questões · 1 questão')
  })
})

describe('Praticar: qual é a próxima', () => {
  const c = (id: string, vezes: number, ultimo_certo: boolean | null, ultima_em: string | null = null) => ({ id, vezes, ultimo_certo, ultima_em })
  it('nunca feitas primeiro; depois as erradas; depois as feitas há mais tempo; vazio = null', async () => {
    const { escolherProxima } = await import('./banco')
    expect(escolherProxima([c('a', 2, true, '2026-10-01'), c('b', 0, null), c('c', 1, false, '2026-09-01')])?.id).toBe('b')
    expect(escolherProxima([c('a', 2, true, '2026-10-01'), c('c', 1, false, '2026-10-02')])?.id).toBe('c')
    expect(escolherProxima([c('a', 2, true, '2026-10-03'), c('d', 1, true, '2026-09-01')])?.id).toBe('d')
    expect(escolherProxima([])).toBeNull()
  })
})

import { rotuloDosAnos } from './banco'
import { lerTemaEscrito, pacoteDoBanco, lerPacote as lerPacote2, textoParaHash as hash2 } from './banco'
describe('tema escrito e exportar/importar de volta', () => {
  it('lê "Especialidade > Tema"; só o nome usa a especialidade padrão', () => {
    expect(lerTemaEscrito('Anestesiologia > Via aérea difícil')).toEqual({ especialidade: 'Anestesiologia', nome: 'Via aérea difícil' })
    expect(lerTemaEscrito('Cirurgia › Anestesiologia › Via aérea')).toEqual({ especialidade: 'Anestesiologia', nome: 'Via aérea' })
    expect(lerTemaEscrito('Via aérea', 'Anestesiologia')).toEqual({ especialidade: 'Anestesiologia', nome: 'Via aérea' })
    expect(lerTemaEscrito('Via aérea')).toBeNull(); expect(lerTemaEscrito('')).toBeNull()
  })
  it('exportar e ler de volta dá a mesma impressão digital (com figura), e o tema volta', () => {
    const blocos = [{ tipo: 'texto' as const, texto: 'Paciente com rigidez de masseter.' }, { tipo: 'imagem' as const, caminho: 'u/banco/x.png' }, { tipo: 'texto' as const, texto: 'Qual a conduta?' }]
    const alternativas = [{ letra: 'A' as const, texto: 'Dantrolene' }, { letra: 'B' as const, texto: 'Esperar' }]
    const p = pacoteDoBanco([{ blocos, alternativas, gabarito: 'A', anulada: false, comentario: 'meu', banca: 'UFMA', ano: 2020, disciplina: 'Anestesiologia', assunto: 'Anestesiologia' }], 'teste')
    const json = JSON.parse(JSON.stringify(p)); json.questoes[0].tema = 'Anestesiologia > Hipertermia maligna' // o que o Claude acrescenta
    const lido = lerPacote2(json)
    expect(hash2(lido.itens[0].questao.blocos, lido.itens[0].questao.alternativas)).toBe(hash2(blocos, alternativas))
    expect(lido.itens[0]).toMatchObject({ gabarito: 'A', banca: 'UFMA', ano: 2020, comentario: 'meu', tema: { especialidade: 'Anestesiologia', nome: 'Hipertermia maligna' } })
    const p2 = pacoteDoBanco([{ blocos, alternativas, gabarito: 'A', anulada: false, banca: null, ano: null, explicacao: 'Dantrolene é o tratamento.', explicacao_origem: 'revisada' }], 't')
    expect(lerPacote2(JSON.parse(JSON.stringify(p2))).itens[0].explicacao).toEqual({ texto: 'Dantrolene é o tratamento.', origem: 'revisada' })
  })
})

describe('uma questão só ("Refazer esta questão", do Caderno)', () => {
  it('o filtro "questao" só aceita id válido e volta igual na URL', () => {
    const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    expect(lerFiltros({ questao: id }).questao).toBe(id); expect(lerFiltros({ questao: 'x; drop' }).questao).toBeNull()
    expect(filtrosParaUrl(lerFiltros({ questao: id }))).toBe(`questao=${id}`)
  })
})
