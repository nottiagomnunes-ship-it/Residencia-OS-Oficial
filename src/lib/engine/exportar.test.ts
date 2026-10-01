import { describe, it, expect } from 'vitest'
import { celula, paraCsv, dataBR, montarBackup, csvAssuntos, csvQuestoes, csvErros, csvSimulados } from './exportar'

describe('CSV', () => {
  it('células: vírgula decimal, aspas, quebras de linha e valores vazios', () => {
    expect(celula(null)).toBe(''); expect(celula(true)).toBe('Sim'); expect(celula(false)).toBe('Não'); expect(celula(84.5)).toBe('84,5')
    expect(celula('a;b')).toBe('"a;b"'); expect(celula('ele disse "oi"')).toBe('"ele disse ""oi"""'); expect(celula('linha1\nlinha2')).toBe('"linha1\nlinha2"')
  })
  it('protege contra fórmulas do Excel em textos', () => {
    for (const f of ['=1+1', '+cmd', '-2+3', '@SOMA(A1)']) expect(celula(f).startsWith("'")).toBe(true)
    expect(celula(-5)).toBe('-5') // número negativo de verdade não é alterado
  })
  it('arquivo: BOM, separador ";" e quebra de linha do Windows', () => {
    const s = paraCsv(['A', 'B'], [[1, 'x']]); expect(s.startsWith('\uFEFF')).toBe(true); expect(s).toBe('\uFEFFA;B\r\n1;x\r\n')
  })
  it('datas em formato brasileiro', () => { expect(dataBR('2026-10-05')).toBe('05/10/2026'); expect(dataBR('2026-10-05T12:00:00Z')).toBe('05/10/2026'); expect(dataBR(null)).toBe('') })
})
describe('planilhas', () => {
  const disc = [{ id: 'd1', nome: 'Clínica' }], top = [{ id: 't1', nome: 'Asma', discipline_id: 'd1', subcategoria: 'Pneumo', grupo: 'Semana 1', ordem: 1, status: 'concluido', prioridade: 1, dificuldade: 3, planned_date: '2026-10-05', completed_date: '2026-10-06' }]
  it('assuntos: nomes no lugar dos ids e rótulos em português', () => {
    const [, linha] = csvAssuntos(disc, top).trim().split('\r\n'); expect(linha).toBe('Clínica;Pneumo;Asma;Semana 1;Concluído;Alta;Difícil;05/10/2026;06/10/2026')
  })
  it('questões: erros e aproveitamento calculados, mais recentes primeiro', () => {
    const csv = csvQuestoes(disc, top, [{ realizado_em: '2026-10-01', discipline_id: 'd1', topic_id: 't1', banca: 'USP', prova: '2025', ano: 2025, total: 50, acertos: 42, tempo_min: 60, dificuldade: 2 },
      { realizado_em: '2026-10-03', discipline_id: 'd1', topic_id: null, total: 10, acertos: 5 }]).trim().split('\r\n')
    expect(csv[1].startsWith('03/10/2026;Clínica;;')).toBe(true); expect(csv[2]).toBe('01/10/2026;Clínica;Asma;USP;2025;2025;50;42;8;84;60;Médio')
  })
  it('caderno de erros e simulados', () => {
    expect(csvErros(disc, top, [{ created_at: '2026-10-02T10:00:00Z', discipline_id: 'd1', topic_id: 't1', motivo: 'chute', enunciado: 'Q1', comentario: null, revisar_em: '2026-10-09', revisado: false }]).trim().split('\r\n')[1])
      .toBe('02/10/2026;Clínica;Asma;Chute;Q1;;09/10/2026;Não')
    expect(csvSimulados([{ data: '2026-09-20', nome: 'Simulado 1', total: 100, acertos: 70, tempo_min: 240 }]).trim().split('\r\n')[1]).toBe('20/09/2026;Simulado 1;100;70;70;240')
  })
})
it('backup: sem ids de usuário, com contagem por tabela', () => {
  const b = montarBackup({ id: 'u', nome: 'Ana', xp: 10 }, { topics: [{ id: 't1', user_id: 'u', nome: 'Asma' }], goals: [] }, 'a@b.com', '2026-10-01T00:00:00Z')
  expect(b.perfil).toEqual({ nome: 'Ana', xp: 10 }); expect(b.tabelas.topics).toEqual([{ id: 't1', nome: 'Asma' }]); expect(b.contagem).toEqual({ topics: 1, goals: 0 })
  expect(b).toMatchObject({ app: 'Residência OS', versao: 1, conta: 'a@b.com' })
})
