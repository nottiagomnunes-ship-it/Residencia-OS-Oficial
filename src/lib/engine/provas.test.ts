import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { zipSync, strToU8 } from 'fflate'
import { lerDocx, lerParagrafos, lerRelacionamentos, decodificar, tipoDaImagem, ArquivoInvalido } from './provas-docx'
import {
  montarQuestoes, lerGabarito, faixas, sugerirAreas, sugerirAreaDaQuestao, textoDosBlocos, corrigir, resultadoPorArea, textoParaCaderno, relogio,
  validarProvaImportada, palpiteDeNome, type QuestaoParaCorrigir,
} from './provas'

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="r" xmlns:a="a"'
const p = (...runs: string[]) => `<w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="720"/></w:tabs></w:pPr>${runs.map(r => `<w:r>${r}</w:r>`).join('')}</w:p>`
const t = (s: string) => `<w:t xml:space="preserve">${s}</w:t>`
const img = (rid: string) => `<w:drawing><a:graphic><a:blip r:embed="${rid}"/></a:graphic></w:drawing>`
const docx = (corpo: string, extra: Record<string, Uint8Array> = {}) => zipSync({
  'word/document.xml': strToU8(`<?xml version="1.0"?><w:document ${W}><w:body>${corpo}</w:body></w:document>`),
  'word/_rels/document.xml.rels': strToU8(`<Relationships><Relationship Id="rId9" Type="image" Target="media/image1.png"/><Relationship Id="rId10" Type="hyperlink" Target="https://x" TargetMode="External"/></Relationships>`),
  'word/media/image1.png': new Uint8Array([137, 80, 78, 71]), 'word/media/sobra.png': new Uint8Array([1]), ...extra,
})

describe('leitura do .docx', () => {
  it('lê texto, entidades, tabulação, quebra de linha e figuras; ignora paradas de tabulação, texto apagado e <w:t/> vazio', () => {
    const rels = lerRelacionamentos('<Relationships><Relationship Id="rId9" Target="media/image1.png"/><Relationship Id="rId2" Target="https://x" TargetMode="External"/></Relationships>')
    expect(rels).toEqual({ rId9: 'word/media/image1.png' })
    const ps = lerParagrafos(`<w:body>${p(t('A &amp; B &lt;C&gt; &#233;&#xE9;'), '<w:tab/>', t('fim'))}${p('<w:t/>', t('linha 1'), '<w:br/>', t('linha 2'))}<w:p/>${p(img('rId9'))}<w:p><w:del><w:r><w:delText>apagado</w:delText></w:r></w:del><w:r>${t('fica')}</w:r></w:p></w:body>`, rels)
    expect(ps.map(x => x.texto)).toEqual(['A & B <C> éé fim', 'linha 1\nlinha 2', '', '', 'fica'])
    expect(ps[3].imagens).toEqual(['word/media/image1.png'])
    expect(decodificar('&foo; &#99999999999;')).toBe('&foo; &#99999999999;')
  })
  it('abre o zip e devolve só as figuras usadas; arquivo que não é .docx dá erro claro', () => {
    const r = lerDocx(docx(p(img('rId9'))))
    expect(Object.keys(r.imagens)).toEqual(['word/media/image1.png'])
    expect(() => lerDocx(new Uint8Array([1, 2, 3]))).toThrow(ArquivoInvalido)
    expect(() => lerDocx(zipSync({ 'x.txt': strToU8('oi') }))).toThrow(/Word/)
  })
  it('só aceita figuras que o navegador mostra', () => {
    expect(tipoDaImagem('word/media/a.PNG')).toBe('image/png'); expect(tipoDaImagem('a.jpeg')).toBe('image/jpeg')
    expect(tipoDaImagem('a.emf')).toBeNull(); expect(tipoDaImagem('a.svg')).toBeNull()
  })
})

describe('montar as questões', () => {
  const ps = (linhas: (string | { img: string })[]) => linhas.map(l => (typeof l === 'string' ? { texto: l, imagens: [] } : { texto: '', imagens: [l.img] }))
  it('título, enunciado com figura, alternativas e gabarito no fim', () => {
    const r = montarQuestoes(ps(['ENARE 2024', 'Instruções', 'QUESTÃO 1', 'Enunciado um.', { img: 'word/media/i.png' }, 'Continua.', 'A) um', 'B) dois', 'C) três', 'D) quatro',
      'Questão 2 - Paciente de 3 anos.', '(a) x', 'b. y', 'c - z', 'd) w', 'e) v', 'GABARITO', '1-A 2-E']))
    expect(r.titulo).toBe('ENARE 2024')
    expect(r.questoes).toHaveLength(2)
    expect(r.questoes[0].blocos).toEqual([{ tipo: 'texto', texto: 'Enunciado um.' }, { tipo: 'imagem', caminho: 'word/media/i.png' }, { tipo: 'texto', texto: 'Continua.' }])
    expect(r.questoes[0].alternativas.map(a => a.letra + a.texto)).toEqual(['Aum', 'Bdois', 'Ctrês', 'Dquatro'])
    expect(r.questoes[1].blocos).toEqual([{ tipo: 'texto', texto: 'Paciente de 3 anos.' }])
    expect(r.questoes[1].alternativas.map(a => a.letra)).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(r.gabaritoTexto).toBe('1-A 2-E')
    expect(r.avisos).toEqual([])
  })
  it('um "B)" no enunciado não vira alternativa; linha depois da alternativa continua a alternativa', () => {
    const r = montarQuestoes(ps(['QUESTÃO 5', 'Veja o item B) abaixo', 'A) primeira', 'continuação', 'C) pulou a B', 'B) segunda']))
    const q = r.questoes[0]
    expect(q.blocos).toHaveLength(1)
    expect(q.alternativas).toEqual([{ letra: 'A', texto: 'primeira\ncontinuação\nC) pulou a B' }, { letra: 'B', texto: 'segunda' }])
    expect(r.avisos).toContain('Questão 5: só 2 alternativas (A a B).')
  })
  it('alternativas separadas por quebra de linha dentro do mesmo parágrafo', () => {
    const r = montarQuestoes([{ texto: 'QUESTÃO 1', imagens: [] }, { texto: 'Pergunta?\nA) a\nB) b\nC) c\nD) d', imagens: [] }])
    expect(r.questoes[0].alternativas).toHaveLength(4)
  })
  it('avisa: nenhuma questão, número repetido, número pulado, sem enunciado, sem alternativas', () => {
    expect(montarQuestoes(ps(['texto qualquer'])).avisos[0]).toMatch(/Nenhuma questão/)
    const r = montarQuestoes(ps(['QUESTÃO 1', 'x', 'A) a', 'B) b', 'C) c', 'D) d', 'QUESTÃO 3', 'A) a', 'B) b', 'C) c', 'D) d', 'QUESTÃO 3', 'enunciado']))
    expect(r.avisos).toEqual(['Depois da questão 1 vem a 3: confira se faltou alguma.', 'Questão 3: sem enunciado.', 'A questão 3 aparece mais de uma vez.',
      'Questão 3: nenhuma alternativa reconhecida (elas precisam começar com "A)", "B)"...).'])
  })
  it('palpite de nome, banca e ano', () => {
    expect(palpiteDeNome('UEPA 2022', 'x.docx')).toEqual({ nome: 'UEPA 2022', banca: 'UEPA', ano: 2022 })
    expect(palpiteDeNome(null, 'Prova_SUS-SP_2023.docx')).toEqual({ nome: 'Prova SUS-SP 2023', banca: '', ano: 2023 })
  })
})

describe('o arquivo de verdade (UEPA 2022)', () => {
  const arq = path.join(__dirname, '__fixtures__', 'UEPA_2022.docx')
  it.skipIf(!existsSync(arq))('100 questões com 5 alternativas, 4 figuras nas questões certas e as áreas em 5 blocos de 20', () => {
    const { paragrafos, imagens } = lerDocx(new Uint8Array(readFileSync(arq)))
    const r = montarQuestoes(paragrafos)
    expect(r.titulo).toBe('UEPA 2022')
    expect(r.avisos).toEqual([])
    expect(r.questoes.map(q => q.numero)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1))
    expect(r.questoes.every(q => q.alternativas.length === 5 && q.alternativas.every(a => a.texto.length > 0))).toBe(true)
    expect(r.questoes.every(q => q.blocos.some(b => b.tipo === 'texto'))).toBe(true)
    expect(Object.keys(imagens)).toHaveLength(4)
    const comFigura = r.questoes.filter(q => q.blocos.some(b => b.tipo === 'imagem')).map(q => q.numero)
    expect(comFigura).toHaveLength(4); expect(comFigura).toContain(4)
    expect(r.questoes[0].blocos[0]).toMatchObject({ texto: expect.stringContaining('teste rápido para COVID') })
    expect(r.questoes[99].alternativas[1].texto).toBe('Choque hipovolêmico hipotensivo.')
    const textos = r.questoes.map(q => textoDosBlocos(q.blocos) + '\n' + q.alternativas.map(a => a.texto).join('\n'))
    const individuais = textos.map(sugerirAreaDaQuestao)
    const esperado = (i: number) => (['preventiva', 'clinica', 'cirurgia', 'go', 'pediatria'] as const)[Math.floor(i / 20)]
    expect(individuais.filter((a, i) => a === esperado(i)).length).toBeGreaterThanOrEqual(80)   // sozinha, a pista acerta a maioria
    const s = sugerirAreas(textos)
    expect(s.porBlocos).toBe(true)
    expect(s.areas.every((a, i) => a === esperado(i))).toBe(true)                                // por blocos, acerta todas
  })
})

describe('área de cada questão', () => {
  it('pistas e idade do paciente', () => {
    expect(sugerirAreaDaQuestao('Lactente de 6 meses com febre')).toBe('pediatria')
    expect(sugerirAreaDaQuestao('Gestante G2 P1, 32 semanas de gestação')).toBe('go')
    expect(sugerirAreaDaQuestao('Vítima de ferimento por arma branca, laparotomia')).toBe('cirurgia')
    expect(sugerirAreaDaQuestao('Calcule a sensibilidade e a especificidade do teste')).toBe('preventiva')
    expect(sugerirAreaDaQuestao('Homem de 60 anos com insuficiência cardíaca e fibrilação atrial')).toBe('clinica')
    expect(sugerirAreaDaQuestao('Assinale a correta')).toBeNull()
  })
  it('sem blocos claros, cada questão fica com a própria sugestão', () => {
    const s = sugerirAreas(['Lactente com febre', 'Gestante com 30 semanas de gestação', 'Assinale a correta'])
    expect(s).toEqual({ areas: ['pediatria', 'go', null], porBlocos: false })
    const mesmas = sugerirAreas(Array(25).fill('Lactente com febre'))   // 5 blocos, mas todos da mesma área: não é divisão por blocos
    expect(mesmas.porBlocos).toBe(false)
  })
})

describe('gabarito', () => {
  const ns = [1, 2, 3, 4, 5]
  it('pares número-letra em vários formatos e anuladas', () => {
    const g = lerGabarito('01-B 2.c 3) D\n4: anulada  5 *', ns)
    expect([...g.respostas]).toEqual([[1, 'B'], [2, 'C'], [3, 'D'], [4, 'X'], [5, 'X']])
    expect(g.faltando).toEqual([]); expect(g.anuladas).toEqual([4, 5])
  })
  it('tabela copiada de PDF: linha de números e linha de letras', () => {
    const g = lerGabarito('GABARITO DEFINITIVO 2022\n01 02 03 04 05\nB A X E C', ns)
    expect([...g.respostas]).toEqual([[1, 'B'], [2, 'A'], [3, 'X'], [4, 'E'], [5, 'C']])
  })
  it('só letras, separadas ou coladas', () => {
    expect([...lerGabarito('B A C', ns).respostas.values()]).toEqual(['B', 'A', 'C'])
    expect(lerGabarito('B A C', ns).faltando).toEqual([4, 5])
    expect([...lerGabarito('BACDE', ns).respostas.values()]).toEqual(['B', 'A', 'C', 'D', 'E'])
    expect([...lerGabarito('bac*e', ns).respostas.values()]).toEqual(['B', 'A', 'C', 'X', 'E'])
  })
  it('número que não existe na prova é avisado e ignorado; texto sem gabarito não inventa nada', () => {
    const g = lerGabarito('1-A 7-B', ns)
    expect([...g.respostas]).toEqual([[1, 'A']]); expect(g.fora).toEqual([7])
    expect(lerGabarito('nada aqui', ns).respostas.size).toBe(0)
  })
  it('faixas', () => { expect(faixas([1, 2, 3, 7, 9, 10, 2])).toBe('1–3, 7, 9–10'); expect(faixas([])).toBe('') })
})

describe('correção', () => {
  const qs: QuestaoParaCorrigir[] = [
    { id: 'a', numero: 1, gabarito: 'A', anulada: false, area: 'clinica' }, { id: 'b', numero: 2, gabarito: 'B', anulada: false, area: 'clinica' },
    { id: 'c', numero: 3, gabarito: 'C', anulada: false, area: 'go' }, { id: 'd', numero: 4, gabarito: 'D', anulada: false, area: null },
    { id: 'e', numero: 5, gabarito: null, anulada: true, area: 'go' },
  ]
  it('certa, errada, em branco, anulada; chute certo vai para o caderno', () => {
    const r = corrigir(qs, { a: { alternativa: 'A', chute: false }, b: { alternativa: 'C', chute: false }, c: { alternativa: 'C', chute: true }, e: { alternativa: 'A', chute: false } })
    expect(r.itens.map(i => i.situacao)).toEqual(['certa', 'errada', 'certa', 'branco', 'anulada'])
    expect(r.itens.filter(i => i.vaiProCaderno).map(i => i.numero)).toEqual([2, 3, 4])
    expect(r).toMatchObject({ total: 4, acertos: 2, erros: 1, brancos: 1, anuladas: 1, chutesCertos: 1, semGabarito: [] })
    expect(resultadoPorArea(r.itens)).toEqual([
      { area: 'clinica', rotulo: 'Clínica Médica', total: 2, acertos: 1, pct: 50 }, { area: 'go', rotulo: 'Ginecologia e Obstetrícia', total: 1, acertos: 1, pct: 100 },
      { area: null, rotulo: 'Sem área', total: 1, acertos: 0, pct: 0 }])
  })
  it('aponta as questões sem gabarito (que impedem a correção)', () => {
    expect(corrigir([{ id: 'x', numero: 9, gabarito: null, anulada: false }], {}).semGabarito).toEqual([9])
  })
  it('texto do caderno e relógio', () => {
    const tx = textoParaCaderno('UEPA 2022', { numero: 4, blocos: [{ tipo: 'texto', texto: 'Enunciado' }, { tipo: 'imagem', caminho: 'x' }], alternativas: [{ letra: 'A', texto: 'um' }, { letra: 'B', texto: 'dois' }] }, null, 'B')
    expect(tx).toBe('UEPA 2022 · Questão 4\n\nEnunciado\n\n[figura]\n\nA) um\nB) dois\n\nSua resposta: em branco · Gabarito: B')
    expect(relogio(0)).toBe('0:00:00'); expect(relogio(3725)).toBe('1:02:05'); expect(relogio(-5)).toBe('0:00:00')
  })
})

describe('conferência no servidor', () => {
  const uid = '11111111-1111-1111-1111-111111111111', id = '22222222-2222-2222-2222-222222222222'
  const q = (o: Record<string, unknown> = {}) => ({ numero: 1, blocos: [{ tipo: 'texto', texto: ' Enunciado ' }], alternativas: [{ letra: 'A', texto: 'a' }, { letra: 'B', texto: 'b' }], gabarito: 'B', anulada: false, area: 'go', ...o })
  const base = (o: Record<string, unknown> = {}) => ({ id, nome: 'UEPA 2022', banca: 'UEPA', ano: 2022, questoes: [q()], ...o })
  it('aceita e limpa', () => {
    const r = validarProvaImportada(base({ questoes: [q({ blocos: [{ tipo: 'texto', texto: ' x ' }, { tipo: 'imagem', caminho: `${uid}/${id}/image1.png` }], area: 'nada' })] }), uid)
    expect(r.ok && r.prova.questoes[0]).toEqual({ numero: 1, blocos: [{ tipo: 'texto', texto: 'x' }, { tipo: 'imagem', caminho: `${uid}/${id}/image1.png` }],
      alternativas: [{ letra: 'A', texto: 'a' }, { letra: 'B', texto: 'b' }], gabarito: 'B', anulada: false, area: null })
  })
  it('recusa o que não deve ser gravado', () => {
    const erro = (v: unknown) => { const r = validarProvaImportada(v, uid); return r.ok ? null : r.erro }
    expect(erro(null)).toMatch(/ausentes/)
    expect(erro(base({ id: 'x' }))).toMatch(/Identificador/)
    expect(erro(base({ nome: '  ' }))).toMatch(/nome/)
    expect(erro(base({ ano: 1500 }))).toMatch(/Ano/)
    expect(erro(base({ questoes: [] }))).toMatch(/não tem questões/)
    expect(erro(base({ questoes: [q(), q()] }))).toMatch(/duas vezes/)
    expect(erro(base({ questoes: [q({ blocos: [{ tipo: 'imagem', caminho: `outra-pessoa/${id}/a.png` }] })] }))).toMatch(/figura/)
    expect(erro(base({ questoes: [q({ blocos: [{ tipo: 'imagem', caminho: `${uid}/${id}/../a.png` }] })] }))).toMatch(/figura/)
    expect(erro(base({ questoes: [q({ alternativas: [{ letra: 'A', texto: 'a' }] })] }))).toMatch(/2 a 5/)
    expect(erro(base({ questoes: [q({ alternativas: [{ letra: 'B', texto: 'a' }, { letra: 'A', texto: 'b' }] })] }))).toMatch(/fora de ordem/)
    expect(erro(base({ questoes: [q({ gabarito: 'E' })] }))).toMatch(/gabarito/)
  })
})

describe('gravar o gabarito', () => {
  it('só o que foi lido; anulada sem letra; letra fora da questão é recusada', async () => {
    const { itensDoGabarito, gabaritoEmTexto } = await import('./provas')
    const qs = [{ numero: 1, alternativas: 5 }, { numero: 2, alternativas: 4 }, { numero: 3, alternativas: 4 }, { numero: 4, alternativas: 4 }]
    const r = itensDoGabarito(qs, lerGabarito('1-E 2-E 3-X', [1, 2, 3, 4]).respostas)
    expect(r.itens).toEqual([{ numero: 1, gabarito: 'E', anulada: false }, { numero: 3, gabarito: null, anulada: true }])
    expect(r.invalidas).toEqual([2])
    expect(gabaritoEmTexto([{ numero: 1, gabarito: 'E', anulada: false }, { numero: 2, gabarito: null, anulada: false }, { numero: 3, gabarito: null, anulada: true }])).toBe('1-E 3-X')
  })
})
