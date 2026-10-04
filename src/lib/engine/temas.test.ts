import { describe, it, expect } from 'vitest'
import { lerListaDeTemas, lerAreaEscrita, porEspecialidade } from './temas'

describe('lista de temas colada', () => {
  it('aceita área › especialidade › tema, especialidade > tema e título com marcadores', () => {
    const { temas, avisos } = lerListaDeTemas(`Cirurgia › Anestesiologia › Via aérea difícil
Anestesiologia > Anestésicos locais
Pediatria; Neonatologia; Icterícia neonatal

Anestesiologia:
- Bloqueios periféricos
• Hipertermia maligna
1. Via aérea difícil`)
    expect(avisos).toEqual([])
    expect(temas).toMatchObject([
      { area: 'cirurgia', especialidade: 'Anestesiologia', nome: 'Via aérea difícil' },
      { area: expect.anything(), especialidade: 'Anestesiologia', nome: 'Anestésicos locais' },
      { area: 'pediatria', especialidade: 'Neonatologia', nome: 'Icterícia neonatal' },
      { area: expect.anything(), especialidade: 'Anestesiologia', nome: 'Bloqueios periféricos' },
      { area: expect.anything(), especialidade: 'Anestesiologia', nome: 'Hipertermia maligna' },
    ]) // "Via aérea difícil" repetida (com outro marcador) entra uma vez só
  })
  it('título de área + especialidade ("Clínica Médica > Cardiologia") vale para os marcadores de baixo', () => {
    expect(lerListaDeTemas('Clínica Médica > Cardiologia\n- Insuficiência cardíaca').temas).toMatchObject([{ area: 'clinica', especialidade: 'Cardiologia', nome: 'Insuficiência cardíaca' }])
  })
  it('marcador sem especialidade antes: avisa', () => {
    const r = lerListaDeTemas('- Choque')
    expect(r.temas).toEqual([]); expect(r.avisos[0]).toContain('sem especialidade')
  })
  it('áreas escritas de vários jeitos', () => {
    expect(lerAreaEscrita('GO')).toBe('go'); expect(lerAreaEscrita('clínica médica')).toBe('clinica'); expect(lerAreaEscrita('Ped')).toBe('pediatria'); expect(lerAreaEscrita('Cardio')).toBeNull()
  })
  it('agrupa por especialidade, em ordem', () => {
    expect(porEspecialidade([{ especialidade: 'Pediatria', nome: 'b' }, { especialidade: 'Anestesio', nome: 'z' }, { especialidade: 'Anestesio', nome: 'a' }]).map(([e, l]) => [e, l.map(t => t.nome)]))
      .toEqual([['Anestesio', ['a', 'z']], ['Pediatria', ['b']]])
  })
})

import { sugerirTemas } from './temas'
describe('sugerir tema pelo texto (lote)', () => {
  const temas = [
    { id: 'via', nome: 'Via aérea difícil', palavras: 'intubação difícil, videolaringoscópio, máscara laríngea, Mallampati' },
    { id: 'bnm', nome: 'Bloqueadores neuromusculares', palavras: 'rocurônio, succinilcolina, sugamadex, neostigmina' },
    { id: 'obs', nome: 'Anestesia obstétrica', palavras: 'cesariana, gestante, parturiente' },
    { id: 'hm', nome: 'Hipertermia maligna', palavras: 'dantrolene' },
    { id: 'al', nome: 'Anestésicos locais e toxicidade sistêmica', palavras: 'lidocaína, bupivacaína, emulsão lipídica' },
  ]
  const fundo = Array.from({ length: 30 }, (_, i) => ({ id: 'f' + i, texto: `Paciente submetido a anestesia geral, questão ${i} sobre o procedimento.` }))
  it('acha pelas palavras-chave mesmo sem o nome do tema no enunciado', () => {
    const r = sugerirTemas([...fundo,
      { id: 'q1', texto: 'Após indução com propofol e rocurônio, o paciente não pode ser ventilado. Qual a conduta?' },
      { id: 'q2', texto: 'Gestante de 38 semanas será submetida a cesariana sob raquianestesia.' },
      { id: 'q3', texto: 'Paciente com rigidez de masseter e hipercapnia após sevoflurano: administrar dantrolene.' },
      { id: 'q4', texto: 'Mulher de 40 anos, 60 kg, dose tóxica de lidocaína com vasoconstritor.' },
    ], temas)
    expect(Object.fromEntries([...r].map(([k, t]) => [k, t.id]))).toEqual({ q1: 'bnm', q2: 'obs', q3: 'hm', q4: 'al' })
  })
  it('"anestesia" em quase todas não decide nada; o nome com palavras que distinguem ainda vale', () => {
    const r = sugerirTemas([...fundo, { id: 'q5', texto: 'Qual o quadro clínico clássico da hipertermia maligna?' }], temas)
    expect(r.get('q5')?.id).toBe('hm')
    expect([...r.keys()].filter(k => k.startsWith('f'))).toEqual([]) // "anestesia geral" não puxa "Anestesia obstétrica"
  })
  it('empate entre temas diferentes: fica sem tema', () => {
    const r = sugerirTemas([{ id: 'q', texto: 'Uso de sugamadex após cesariana' }], temas)
    expect(r.has('q')).toBe(false)
  })
  it('lista colada com palavras-chave depois de ":"', () => {
    expect(lerListaDeTemas('Anestesiologia:\n- Hipertermia maligna: dantrolene, rigidez de masseter').temas)
      .toEqual([{ area: expect.anything(), especialidade: 'Anestesiologia', nome: 'Hipertermia maligna', palavras: 'dantrolene, rigidez de masseter' }])
  })
})

import { listaDeTemasEmTexto } from './temas'
describe('lista de temas em texto (para mandar ao Claude)', () => {
  it('uma linha por tema e, colada de volta, dá a mesma lista (área, especialidade, nome e palavras-chave)', () => {
    const temas = [
      { id: '1', area: 'cirurgia' as const, especialidade: 'Anestesiologia', nome: 'Hipertermia maligna', palavras: 'dantrolene, rigidez de masseter' },
      { id: '2', area: null, especialidade: 'Ética', nome: 'Sigilo: limites', palavras: null },
      { id: '3', area: 'pediatria' as const, especialidade: 'Neonatologia', nome: 'Icterícia > fototerapia', palavras: null },
    ]
    const txt = listaDeTemasEmTexto(temas)
    expect(txt.split('\n')).toEqual(['Cirurgia > Anestesiologia > Hipertermia maligna: dantrolene, rigidez de masseter', 'Ética > Sigilo - limites', 'Pediatria > Neonatologia > Icterícia - fototerapia'])
    const volta = lerListaDeTemas(txt)
    expect(volta.avisos).toEqual([])
    expect(volta.temas.map(t => [t.area, t.especialidade, t.nome, t.palavras])).toEqual([
      ['cirurgia', 'Anestesiologia', 'Hipertermia maligna', 'dantrolene, rigidez de masseter'], [expect.anything(), 'Ética', 'Sigilo - limites', null],
      ['pediatria', 'Neonatologia', 'Icterícia - fototerapia', null]])
  })
})
