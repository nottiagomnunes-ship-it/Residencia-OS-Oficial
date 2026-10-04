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
    expect(temas).toEqual([
      { area: 'cirurgia', especialidade: 'Anestesiologia', nome: 'Via aérea difícil' },
      { area: expect.anything(), especialidade: 'Anestesiologia', nome: 'Anestésicos locais' },
      { area: 'pediatria', especialidade: 'Neonatologia', nome: 'Icterícia neonatal' },
      { area: expect.anything(), especialidade: 'Anestesiologia', nome: 'Bloqueios periféricos' },
      { area: expect.anything(), especialidade: 'Anestesiologia', nome: 'Hipertermia maligna' },
    ]) // "Via aérea difícil" repetida (com outro marcador) entra uma vez só
  })
  it('título de área + especialidade ("Clínica Médica > Cardiologia") vale para os marcadores de baixo', () => {
    expect(lerListaDeTemas('Clínica Médica > Cardiologia\n- Insuficiência cardíaca').temas).toEqual([{ area: 'clinica', especialidade: 'Cardiologia', nome: 'Insuficiência cardíaca' }])
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
