import { it, expect } from 'vitest'
import { ocupadosPorData, janelasDoDia, hhmmParaMin, minParaHhmm, ordenarDia, conflitosComOcupados, descreverConflitos } from './compromissos'
import { gerarCronograma } from './schedule'

const C = (o: object = {}) => ({ titulo: 'Internato', tipo: 'semanal' as const, dias: [1, 2, 3, 4, 5], data: null, ini: 420, fim: 1140, valido_de: null, valido_ate: null, ...o })

it('converte horários', () => { expect(hhmmParaMin('07:30:00')).toBe(450); expect(minParaHhmm(1140)).toBe('19:00') })
it('semanal respeita dias da semana e validade', () => {
  expect(Object.keys(ocupadosPorData([C({ valido_ate: '2026-10-02' })], '2026-09-28', '2026-10-09')).sort()).toEqual(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'])
  expect(Object.keys(ocupadosPorData([C()], '2026-10-03', '2026-10-04'))).toEqual([]) // sábado e domingo
})
it('plantão noturno ocupa o fim do dia e a manhã seguinte', () => {
  const o = ocupadosPorData([C({ tipo: 'pontual', dias: [], data: '2026-10-07', ini: 1140, fim: 420 })], '2026-10-06', '2026-10-09')
  expect(o['2026-10-07']).toEqual([{ ini: 1140, fim: 1440, titulo: 'Internato' }]); expect(o['2026-10-08']).toEqual([{ ini: 0, fim: 420, titulo: 'Internato (continuação)' }])
})
it('janelas livres descontam compromisso e folga, e descartam janelas curtas', () => {
  expect(janelasDoDia(360, 1380, [{ ini: 420, fim: 1140 }], 30)).toEqual([[360, 390], [1170, 1380]])
  expect(janelasDoDia(360, 1380, [{ ini: 400, fim: 1140 }], 30)).toEqual([[1170, 1380]])
  expect(janelasDoDia(360, 1380, [{ ini: 0, fim: 1440 }], 0)).toEqual([])
})

const base = {
  hoje: '2026-09-30', prova: '2026-11-30', diasDisponiveis: [0, 1, 2, 3, 4, 5, 6], minutosDia: 240, questoesDia: 40,
  disciplinas: [{ id: 'A', nome: 'Clínica', peso: 3 }], fixos: [], minutosRevisaoPorDia: {},
  topicos: Array.from({ length: 30 }, (_, i) => ({ id: 'A' + i, nome: 'T' + i, disciplineId: 'A', prioridade: 2, dificuldade: 2 })),
}
const gerar = (cs: ReturnType<typeof C>[]) => gerarCronograma({ ...base, janela: { ini: 360, fim: 1380 }, folga: 30, ocupados: ocupadosPorData(cs, '2026-09-29', '2026-12-01') })

it('nenhum bloco invade o horário do internato (07h–19h, com folga de 30 min)', () => {
  const r = gerar([C()]), comHora = r.blocos.filter(b => b.hora_ini)
  expect(comHora.length).toBeGreaterThan(0)
  for (const b of comHora) {
    const d = new Date(b.data + 'T00:00:00Z').getUTCDay()
    if (d >= 1 && d <= 5) expect(hhmmParaMin(b.hora_ini!) >= 1170 || hhmmParaMin(b.hora_fim!) <= 390).toBe(true)
  }
})
it('dia totalmente ocupado fica sem blocos', () => {
  expect(gerar([C({ tipo: 'pontual', dias: [], data: '2026-10-05', ini: 0, fim: 1440 })]).blocos.filter(b => b.data === '2026-10-05')).toHaveLength(0)
})
it('depois de plantão noturno, o estudo só começa após o fim do plantão', () => {
  const r = gerar([C({ tipo: 'pontual', dias: [], data: '2026-10-06', ini: 1140, fim: 420 })])
  const manha = r.blocos.filter(b => b.data === '2026-10-07' && b.hora_ini)
  expect(manha.length).toBeGreaterThan(0); for (const b of manha) expect(hhmmParaMin(b.hora_ini!)).toBeGreaterThanOrEqual(450)
})
it('sem compromissos o comportamento anterior se mantém (começa às 08:00)', () => {
  const r = gerarCronograma({ ...base }); expect(r.blocos.find(b => b.tipo === 'estudo')?.hora_ini).toBe('08:00')
})

it('ordena o dia: compromissos e itens por horário, itens sem horário por último', () => {
  const r = ordenarDia([{ ini: 420, fim: 1140, titulo: 'Internato' }], [{ hora_ini: '19:30' }, { hora_ini: null }, { hora_ini: '06:00' }])
  expect(r.map(l => (l.tipo === 'ocupado' ? 'ocupado' : l.x.hora_ini))).toEqual(['06:00', 'ocupado', '19:30', null])
})

it('conflito: sobreposição real; encostar não conta', () => {
  const oc = [{ ini: 420, fim: 1140, titulo: 'Internato' }]
  expect(conflitosComOcupados(480, 540, oc)).toHaveLength(1); expect(conflitosComOcupados(400, 430, oc)).toHaveLength(1)
  expect(conflitosComOcupados(360, 420, oc)).toHaveLength(0); expect(conflitosComOcupados(1140, 1200, oc)).toHaveLength(0)
})
it('mensagem de conflito', () => {
  expect(descreverConflitos([])).toBeNull()
  expect(descreverConflitos([{ ini: 420, fim: 1140, titulo: 'Internato' }])).toBe('Este horário cai sobre "Internato" (07:00–19:00).')
  expect(descreverConflitos([{ ini: 1140, fim: 1440, titulo: 'Plantão' }])).toContain('19:00–24:00')
})

it('mensagem de conflito distingue compromisso e tarefa', () => {
  expect(descreverConflitos([{ ini: 420, fim: 1140, titulo: 'Internato' }, { ini: 480, fim: 540, titulo: 'DPOC', tarefa: true }]))
    .toBe('Este horário cai sobre "Internato" (07:00–19:00) e a tarefa "DPOC" (08:00–09:00).')
})
