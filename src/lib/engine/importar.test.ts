import { describe, it, expect } from 'vitest'
import { parseCronograma } from './importar'

const H = '2026-09-30'
const p = (t: string) => parseCronograma(t, H)

describe('parseCronograma', () => {
  it('títulos com # e ## e assuntos por linha', () => {
    const r = p('# Clínica Médica\n## Cardiologia\nHipertensão arterial\n- Insuficiência cardíaca\n2. DPOC\n\n# Pediatria\nBronquiolite')
    expect(r.itens.map(i => [i.disciplina, i.subcategoria, i.nome])).toEqual([
      ['Clínica Médica', 'Cardiologia', 'Hipertensão arterial'], ['Clínica Médica', 'Cardiologia', 'Insuficiência cardíaca'],
      ['Clínica Médica', 'Cardiologia', 'DPOC'], ['Pediatria', null, 'Bronquiolite']])
  })
  it('formato com >', () => {
    const r = p('Cirurgia > Trauma > Trauma torácico\nPreventiva > Ética médica')
    expect(r.itens).toEqual([{ disciplina: 'Cirurgia', subcategoria: 'Trauma', nome: 'Trauma torácico', data: null, grupo: null }, { disciplina: 'Preventiva', subcategoria: null, nome: 'Ética médica', data: null, grupo: null }])
  })
  it('datas no início e no fim, com dia da semana e ISO', () => {
    const r = p('# Cirurgia\n05/10 Apendicite\nPancreatite aguda - 06/10\nColecistite (2026-10-07)\nSegunda 12/10: Hérnias')
    expect(r.itens.map(i => [i.nome, i.data])).toEqual([['Apendicite', '2026-10-05'], ['Pancreatite aguda', '2026-10-06'], ['Colecistite', '2026-10-07'], ['Hérnias', '2026-10-12']])
  })
  it('não confunde "tipo 1/2" com data; data sem ano que já passou vai para o ano seguinte', () => {
    expect(p('# Clínica\nDiabetes tipo 1/2').itens[0]).toMatchObject({ nome: 'Diabetes tipo 1/2', data: null })
    expect(p('# Clínica\nTema - 01/02').itens[0].data).toBe('2027-02-01')
  })
  it('data inválida vira aviso e o assunto entra sem data', () => {
    const r = p('# Clínica\nTema - 31/02')
    expect(r.itens[0].data).toBeNull(); expect(r.avisos[0]).toMatch(/data inválida/)
  })
  it('título em MAIÚSCULAS (comum em PDF) e título com dois-pontos', () => {
    const r = p('CLÍNICA MÉDICA\nHipertensão\nPediatria:\nBronquiolite')
    expect(r.itens.map(i => i.disciplina)).toEqual(['Clínica Médica', 'Pediatria'])
  })
  it('linhas sem disciplina e repetidas geram aviso', () => {
    const r = p('Assunto solto\n# Clínica\nDPOC\ndpoc')
    expect(r.itens).toHaveLength(1); expect(r.avisos.join(' ')).toMatch(/sem disciplina/); expect(r.avisos.join(' ')).toMatch(/repetidas/)
  })
  it('texto vazio não gera nada', () => { expect(p('  \n\n')).toEqual({ itens: [], avisos: [] }) })
})

describe('ordem de estudo (Semana, Dia, Bloco...)', () => {
  it('"# SEMANA 1" é a ordem, não uma disciplina: ## é a disciplina', () => {
    const r = p('# SEMANA 1\n## Pediatria\nImunizações\n## Cirurgia\nTrauma: Avaliação Inicial, Vias Aéreas e Trauma Torácico\n## Preventiva\nPrincípios e Diretrizes do SUS\n# SEMANA 2\n## Pediatria\nBronquiolite')
    expect(r.itens.map(i => [i.grupo, i.disciplina, i.subcategoria, i.nome])).toEqual([
      ['Semana 1', 'Pediatria', null, 'Imunizações'], ['Semana 1', 'Cirurgia', null, 'Trauma: Avaliação Inicial, Vias Aéreas e Trauma Torácico'],
      ['Semana 1', 'Preventiva', null, 'Princípios e Diretrizes do SUS'], ['Semana 2', 'Pediatria', null, 'Bronquiolite']])
    expect(r.avisos).toEqual([])
  })
  it('semana sozinha na linha, ### como subcategoria e "Dia 2:" com dois-pontos', () => {
    const r = p('Semana 1\n## Clínica\n### Cardio\nHAS\nDia 2:\n# Pediatria\nBronquiolite')
    expect(r.itens.map(i => [i.grupo, i.disciplina, i.subcategoria, i.nome])).toEqual([['Semana 1', 'Clínica', 'Cardio', 'HAS'], ['Dia 2', 'Pediatria', null, 'Bronquiolite']])
  })
  it('sem semana, # continua sendo a disciplina e ## a subcategoria', () => {
    expect(p('# Clínica\n## Cardio\nHAS').itens[0]).toMatchObject({ disciplina: 'Clínica', subcategoria: 'Cardio', grupo: null })
  })
  it('siglas em maiúsculas são assuntos, não títulos', () => {
    expect(p('# Clínica\nDPOC\nTEP\nAVC').itens.map(i => i.nome)).toEqual(['DPOC', 'TEP', 'AVC'])
  })
  it('depois de trocar de semana é preciso dizer a disciplina de novo', () => {
    const r = p('# Semana 1\n## Clínica\nHAS\n# Semana 2\nDiabetes')
    expect(r.itens).toHaveLength(1); expect(r.avisos[0]).toMatch(/sem disciplina/)
  })
})
