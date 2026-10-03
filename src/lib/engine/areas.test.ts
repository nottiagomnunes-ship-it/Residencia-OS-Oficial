import { describe, it, expect } from 'vitest'
import { AREAS, ROTULO_AREA, SIGLA_AREA, COR_AREA, ehArea, lerArea, normalizar, sugerirArea, agruparPorArea, ordenarPorArea, rotuloComArea, resumoPorArea, areaDeMenorAcerto } from './areas'

describe('as 5 áreas', () => {
  it('são as da prova, nesta ordem, cada uma com nome, sigla e cor próprios', () => {
    expect(AREAS).toEqual(['clinica', 'cirurgia', 'pediatria', 'go', 'preventiva'])
    expect(Object.values(ROTULO_AREA)).toEqual(['Clínica Médica', 'Cirurgia', 'Pediatria', 'Ginecologia e Obstetrícia', 'Preventiva']); expect(SIGLA_AREA.go).toBe('GO')
    expect(new Set(Object.values(COR_AREA)).size).toBe(5)
    for (const c of Object.values(COR_AREA)) expect(c).not.toMatch(/^#(EF4444|DC2626|F87171)$/i)     // nada de vermelho de alerta
  })
  it('só valores válidos viram área (o que vem do banco, de um formulário ou de um arquivo pode ser qualquer coisa)', () => {
    for (const a of AREAS) { expect(ehArea(a)).toBe(true); expect(lerArea(a)).toBe(a) }
    for (const v of ['Clinica', 'CLINICA', 'outra', '', null, undefined, 5, {}, ['clinica']]) { expect(ehArea(v)).toBe(false); expect(lerArea(v)).toBeNull() }
  })
})

describe('sugerir a área pelo nome da disciplina', () => {
  const casos: [string, string | null][] = [
    // Clínica Médica
    ['Clínica Médica', 'clinica'], ['Clínica', 'clinica'], ['Cardiologia', 'clinica'], ['Nefrologia', 'clinica'], ['Pneumologia', 'clinica'], ['Gastroenterologia', 'clinica'], ['Endocrinologia', 'clinica'], ['Hematologia', 'clinica'],
    ['Infectologia', 'clinica'], ['Reumatologia', 'clinica'], ['Neurologia', 'clinica'], ['Dermatologia', 'clinica'], ['Psiquiatria', 'clinica'], ['Geriatria', 'clinica'], ['Medicina Intensiva', 'clinica'], ['Terapia Intensiva', 'clinica'], ['Oncologia', 'clinica'],
    // Cirurgia
    ['Cirurgia', 'cirurgia'], ['Cirurgia Geral', 'cirurgia'], ['Trauma', 'cirurgia'], ['Trauma: Avaliação Inicial, Vias Aéreas e Trauma Torácico', 'cirurgia'], ['Ortopedia', 'cirurgia'], ['Urologia', 'cirurgia'], ['Oftalmologia', 'cirurgia'], ['Otorrinolaringologia', 'cirurgia'], ['Anestesiologia', 'cirurgia'], ['Cirurgia Vascular', 'cirurgia'], ['Clínica Cirúrgica', 'cirurgia'],
    // Pediatria
    ['Pediatria', 'pediatria'], ['Neonatologia', 'pediatria'], ['Puericultura', 'pediatria'], ['Pediatria Geral', 'pediatria'],
    // GO
    ['Ginecologia e Obstetrícia', 'go'], ['Ginecologia', 'go'], ['Obstetrícia', 'go'], ['GO', 'go'], ['Pré-natal', 'go'],
    // Preventiva
    ['Preventiva', 'preventiva'], ['Medicina Preventiva', 'preventiva'], ['Medicina Preventiva e Social', 'preventiva'], ['Saúde Coletiva', 'preventiva'], ['Epidemiologia', 'preventiva'], ['Bioestatística', 'preventiva'], ['SUS', 'preventiva'], ['Princípios e Diretrizes do SUS', 'preventiva'], ['Ética Médica', 'preventiva'],
    // casos que misturam termos: vale o mais específico
    ['Cirurgia Pediátrica', 'cirurgia'], ['Neurologia Pediátrica', 'pediatria'], ['Infectologia Pediátrica', 'pediatria'], ['Ortopedia Pediátrica', 'cirurgia'], ['Oncologia Ginecológica', 'go'],
  ]
  for (const [nome, area] of casos) it(`"${nome}" → ${area}`, () => { expect(sugerirArea(nome)).toBe(area) })
  it('o que é ambíguo ou desconhecido fica sem sugestão (a pessoa escolhe)', () => { for (const n of ['Imunizações', 'Mastologia', 'Medicina de Emergência', 'Semana 1', 'Anatomia', 'Revisão geral', '', '   ', '###']) expect(sugerirArea(n), n).toBeNull() })
  it('acentos, maiúsculas e pontuação não atrapalham', () => { expect(sugerirArea('  CARDIOLOGIA!!  ')).toBe('clinica'); expect(sugerirArea('ginecologia e obstetricia')).toBe('go'); expect(sugerirArea('cirurgia-geral')).toBe('cirurgia') })
  it('palavras curtas só casam inteiras: "SUS" e "GO" não aparecem dentro de outras palavras', () => {
    expect(sugerirArea('Suspeita diagnóstica')).toBeNull(); expect(sugerirArea('Gota e artrite')).toBeNull(); expect(sugerirArea('Cardiopatias do GO')).toBe('go'); expect(sugerirArea('Ligamentos')).toBeNull()
  })
  it('normalizar', () => { expect(normalizar('Ginecologia e Obstetrícia')).toBe('ginecologia e obstetricia'); expect(normalizar('  Pré-natal / Parto ')).toBe('pre natal parto') })
})

describe('agrupar e ordenar por área', () => {
  const d = (nome: string, area: any) => ({ nome, area })
  const lista = [d('Pediatria', 'pediatria'), d('Cardiologia', 'clinica'), d('Anatomia', null), d('Trauma', 'cirurgia'), d('Nefrologia', 'clinica')]
  it('na ordem das áreas, com "Sem área" por último, e áreas vazias não aparecem', () => {
    const g = agruparPorArea(lista); expect(g.map(x => x.rotulo)).toEqual(['Clínica Médica', 'Cirurgia', 'Pediatria', 'Sem área']); expect(g[0].itens.map(i => i.nome)).toEqual(['Cardiologia', 'Nefrologia']); expect(g.at(-1)!.area).toBeNull()
  })
  it('sem nenhuma disciplina, não há grupos; tudo sem área vira um grupo só', () => { expect(agruparPorArea([])).toEqual([]); expect(agruparPorArea([d('A', null), d('B', null)]).map(x => x.rotulo)).toEqual(['Sem área']) })
  it('ordenar mantém a ordem de quem é da mesma área e põe as sem área no fim', () => { expect(ordenarPorArea(lista).map(x => x.nome)).toEqual(['Cardiologia', 'Nefrologia', 'Trauma', 'Pediatria', 'Anatomia']) })
  it('ordenar não altera a lista original', () => { const c = [...lista]; ordenarPorArea(lista); expect(lista).toEqual(c) })
})

describe('nome na lista de escolha', () => {
  it('com a área na frente; sem área, só o nome', () => { expect(rotuloComArea('Cardiologia', 'clinica')).toBe('Clínica · Cardiologia'); expect(rotuloComArea('Obstetrícia', 'go')).toBe('GO · Obstetrícia'); expect(rotuloComArea('Anatomia', null)).toBe('Anatomia') })
  it('não repete quando o nome já é a área', () => {
    for (const [n, a] of [['Pediatria', 'pediatria'], ['Clínica Médica', 'clinica'], ['Cirurgia', 'cirurgia'], ['Ginecologia e Obstetrícia', 'go'], ['Preventiva', 'preventiva'], ['GO', 'go']] as const) expect(rotuloComArea(n, a), n).toBe(n)
  })
})

describe('resumo por área (Desempenho)', () => {
  const d = (area: any, total: number, acertos: number) => ({ area, total, acertos })
  it('soma as disciplinas de cada área; as 5 áreas sempre aparecem, mesmo sem questões', () => {
    const r = resumoPorArea([d('clinica', 100, 80), d('clinica', 50, 30), d('cirurgia', 40, 20)]); expect(r.map(x => x.rotulo)).toEqual(['Clínica Médica', 'Cirurgia', 'Pediatria', 'Ginecologia e Obstetrícia', 'Preventiva'])
    expect(r[0]).toMatchObject({ disciplinas: 2, total: 150, acertos: 110, pct: 73 }); expect(r[1]).toMatchObject({ total: 40, pct: 50 }); expect(r[2]).toMatchObject({ disciplinas: 0, total: 0, pct: null })
  })
  it('"Sem área" só aparece se houver questões nela', () => {
    expect(resumoPorArea([d(null, 0, 0)]).some(x => x.area === null)).toBe(false)
    const r = resumoPorArea([d(null, 60, 30), d('go', 10, 9)]); expect(r.at(-1)).toMatchObject({ area: null, rotulo: 'Sem área', total: 60, pct: 50 })
  })
  it('arredonda o aproveitamento', () => { expect(resumoPorArea([d('go', 3, 2)])[3].pct).toBe(67) })
  it('a área de menor acerto só é apontada com comparação justa (2 áreas, mínimo de questões)', () => {
    const r = resumoPorArea([d('clinica', 200, 160), d('cirurgia', 100, 55), d('pediatria', 20, 1)])
    expect(areaDeMenorAcerto(r)!.area).toBe('cirurgia')                                       // pediatria tem poucas questões: não entra
    expect(areaDeMenorAcerto(resumoPorArea([d('clinica', 200, 160)]))).toBeNull(); expect(areaDeMenorAcerto(resumoPorArea([d('clinica', 20, 10), d('go', 20, 5)]))).toBeNull(); expect(areaDeMenorAcerto(resumoPorArea([]))).toBeNull()
  })
  it('"Sem área" nunca é apontada como a mais fraca', () => { expect(areaDeMenorAcerto(resumoPorArea([d(null, 500, 50), d('clinica', 100, 90), d('go', 100, 80)]))!.area).toBe('go') })
})
