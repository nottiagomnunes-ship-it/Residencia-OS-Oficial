import { describe, it, expect } from 'vitest'
import { limiarDoGesto, interpretarGesto, acaoDoGesto, rotuloDoGesto } from './gestos'

describe('limiar do gesto', () => {
  it('40% da largura, entre 60 e 110 px', () => { expect([100, 200, 300, 600].map(limiarDoGesto)).toEqual([60, 80, 110, 110]) })
})
describe('interpretar o movimento', () => {
  it('um deslize horizontal longo é gesto, para o lado certo', () => {
    expect(interpretarGesto(120, 5, 300)).toBe('direita'); expect(interpretarGesto(-120, -8, 300)).toBe('esquerda')
  })
  it('movimento curto não conta (toque com o dedo tremendo)', () => { expect(interpretarGesto(40, 0, 300)).toBeNull(); expect(interpretarGesto(-109, 0, 300)).toBeNull() })
  it('movimento mais vertical que horizontal é rolagem, não gesto', () => {
    expect(interpretarGesto(120, 100, 300)).toBeNull()     // 120 < 100 × 1,5
    expect(interpretarGesto(150, 100, 300)).toBe('direita') // 150 = 100 × 1,5: já vale
    expect(interpretarGesto(0, 300, 300)).toBeNull()
  })
  it('tarefas estreitas pedem menos distância', () => { expect(interpretarGesto(65, 0, 100)).toBe('direita'); expect(interpretarGesto(65, 0, 400)).toBeNull() })
})
describe('o que cada sentido faz', () => {
  it('para a esquerda, adia qualquer tarefa aberta', () => {
    for (const tipo of ['estudo', 'revisao', 'questoes', 'simulado', 'flashcards']) expect(acaoDoGesto('esquerda', tipo, 'agendado')).toBe('adiar')
  })
  it('para a direita, conclui estudo e flashcards; revisão, questões e simulado abrem o registro (nunca concluem sozinhos)', () => {
    expect(acaoDoGesto('direita', 'estudo', 'proximo')).toBe('concluir'); expect(acaoDoGesto('direita', 'flashcards', 'agendado')).toBe('concluir')
    for (const tipo of ['revisao', 'questoes', 'simulado']) expect(acaoDoGesto('direita', tipo, 'atrasado')).toBe('abrir')
  })
  it('tarefa concluída não reage a nada', () => { expect(acaoDoGesto('direita', 'estudo', 'concluido')).toBeNull(); expect(acaoDoGesto('esquerda', 'estudo', 'concluido')).toBeNull() })
  it('o texto atrás da tarefa diz o que vai acontecer', () => {
    expect(rotuloDoGesto('concluir', 'estudo')).toBe('Concluir'); expect(rotuloDoGesto('adiar', 'estudo')).toBe('Adiar 1 dia')
    expect(rotuloDoGesto('abrir', 'revisao')).toBe('Fazer revisão'); expect(rotuloDoGesto('abrir', 'questoes')).toBe('Registrar questões'); expect(rotuloDoGesto('abrir', 'simulado')).toBe('Registrar simulado')
    expect(rotuloDoGesto(null, 'estudo')).toBeUndefined()
  })
})
