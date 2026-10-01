import { describe, it, expect } from 'vitest'
import { gerarCronograma, ordemDeEstudo, type Entrada, type Topico } from './schedule'

const disc = [{ id: 'A', nome: 'Clínica', peso: 3 }, { id: 'B', nome: 'Preventiva', peso: 1 }]
const topicos = (n: number, d = 'A'): Topico[] => Array.from({ length: n }, (_, i) => ({ id: `${d}${i}`, nome: `${d} ${i}`, disciplineId: d, prioridade: 2, dificuldade: 2 }))
const base = (o: Partial<Entrada> = {}): Entrada => ({
  hoje: '2026-09-30', prova: '2026-12-15', diasDisponiveis: [1, 2, 3, 4, 5], minutosDia: 240, questoesDia: 40,
  disciplinas: disc, topicos: [...topicos(6, 'A'), ...topicos(6, 'B')], fixos: [], minutosRevisaoPorDia: {}, ...o,
})
const dow = (d: string) => new Date(d + 'T00:00:00Z').getUTCDay()

it('intercala disciplinas pelo peso (3:1)', () => {
  expect(ordemDeEstudo(disc, [...topicos(4, 'A'), ...topicos(4, 'B')]).slice(0, 4).map(t => t.disciplineId)).toEqual(['A', 'A', 'B', 'A'])
})
it('dentro da disciplina, prioridade alta vem primeiro', () => {
  const t: Topico[] = [{ id: 'x', nome: 'x', disciplineId: 'A', prioridade: 3, dificuldade: 2 }, { id: 'y', nome: 'y', disciplineId: 'A', prioridade: 1, dificuldade: 2 }]
  expect(ordemDeEstudo(disc, t)[0].id).toBe('y')
})
describe('gerarCronograma', () => {
  it('só usa dias disponíveis e nada depois da prova', () => {
    const { blocos } = gerarCronograma(base())
    expect(blocos.length).toBeGreaterThan(0)
    for (const b of blocos) { expect([1, 2, 3, 4, 5]).toContain(dow(b.data)); expect(b.data < '2026-12-15').toBe(true) }
  })
  it('nunca passa da capacidade diária', () => {
    const por = new Map<string, number>()
    for (const b of gerarCronograma(base()).blocos) por.set(b.data, (por.get(b.data) ?? 0) + b.duracao_min)
    por.forEach(m => expect(m).toBeLessThanOrEqual(240))
  })
  it('desconta revisões já agendadas do dia', () => {
    const { blocos } = gerarCronograma(base({ minutosRevisaoPorDia: { '2026-10-01': 120 } }))
    expect(blocos.filter(b => b.data === '2026-10-01').reduce((s, b) => s + b.duracao_min, 0)).toBeLessThanOrEqual(240 - 72)
  })
  it('reta final não tem estudo novo e tem simulado semanal', () => {
    const { blocos } = gerarCronograma(base())
    expect(blocos.filter(b => b.data >= '2026-11-27' && b.tipo === 'estudo')).toHaveLength(0)
    expect(blocos.filter(b => b.tipo === 'simulado').length).toBeGreaterThanOrEqual(2)
  })
  it('respeita assunto com data fixa', () => {
    const fixo: Topico = { ...topicos(1, 'A')[0], id: 'F', plannedDate: '2026-10-10' }
    expect(gerarCronograma(base({ fixos: [fixo], topicos: [] })).blocos.find(b => b.tipo === 'estudo' && b.topic_id === 'F')?.data).toBe('2026-10-10')
  })
  it('avisa quando o tempo não fecha', () => {
    const r = gerarCronograma(base({ prova: '2026-10-14', topicos: topicos(200, 'A') }))
    expect(r.naoAlocados).toBeGreaterThan(0); expect(r.avisos[0]).toMatch(/Faltam/)
  })
  it('reforço de assunto fraco entra primeiro, sem vínculo com o assunto', () => {
    const r = gerarCronograma(base({ reforcos: [{ id: 'W', nome: 'Hipertensão', disciplineId: 'A', prioridade: 1, dificuldade: 2 }] }))
    const b = r.blocos.find(x => x.tipo === 'estudo')!
    expect(b.titulo).toBe('Reforço — Hipertensão'); expect(b.topic_id).toBeNull(); expect(b.duracao_min).toBe(45)
  })
  it('avisa quando a prova já passou', () => { expect(gerarCronograma(base({ prova: '2026-09-30' })).avisos[0]).toMatch(/prova/) })
})

it('a ordem definida pelo usuário vence o rodízio por peso; o resto vem depois', () => {
  const t = (id: string, disciplineId: string, ordem: number | null): Topico => ({ id, nome: id, disciplineId, prioridade: 2, dificuldade: 2, ordem })
  const r = ordemDeEstudo(disc, [t('c', 'A', 2), t('x', 'A', null), t('a', 'B', 0), t('b', 'A', 1)])
  expect(r.map(x => x.id)).toEqual(['a', 'b', 'c', 'x'])
})

describe('ritmo por semana', () => {
  const g = (id: string, grupo: string, ordem: number): Topico => ({ id, nome: id, disciplineId: 'A', prioridade: 2, dificuldade: 2, ordem, grupo })
  it('3 assuntos na semana ficam em 3 dias diferentes dentro dela, não amontoados no primeiro', () => {
    const r = gerarCronograma(base({ prova: '2026-12-15', topicos: [g('a', 'Semana 1', 0), g('b', 'Semana 1', 1), g('c', 'Semana 1', 2), g('d', 'Semana 2', 3), g('e', 'Semana 2', 4)] }))
    const dia = (id: string) => r.blocos.find(b => b.tipo === 'estudo' && b.topic_id === id)!.data
    expect(new Set(['a', 'b', 'c'].map(dia)).size).toBe(3)
    for (const id of ['a', 'b', 'c']) expect(dia(id) <= '2026-10-04').toBe(true)   // semana 1 = segunda 28/09 a domingo 04/10
    for (const id of ['d', 'e']) { expect(dia(id) >= '2026-10-05').toBe(true); expect(dia(id) <= '2026-10-11').toBe(true) }
    expect(new Set(['d', 'e'].map(dia)).size).toBe(2)
  })
  it('se restarem menos de 3 dias úteis na semana, a Semana 1 começa na próxima segunda', () => {
    const r = gerarCronograma(base({ hoje: '2026-10-02', prova: '2026-12-15', topicos: [0, 1, 2].map(i => g('s' + i, 'Semana 1', i)) })) // sexta-feira
    const datas = r.blocos.filter(b => b.tipo === 'estudo').map(b => b.data)
    expect(datas).toHaveLength(3); for (const d of datas) { expect(d >= '2026-10-05').toBe(true); expect(d <= '2026-10-11').toBe(true) }
  })
  it('semana com assuntos demais avisa que parte foi para a seguinte', () => {
    const r = gerarCronograma(base({ prova: '2026-12-15', topicos: Array.from({ length: 12 }, (_, i) => g('t' + i, 'Semana 1', i)) }))
    expect(r.avisos.join(' ')).toMatch(/"Semana 1" não couberam na semana/)
  })
  it('sem semanas o comportamento anterior continua (preenche o dia)', () => {
    const r = gerarCronograma(base({ topicos: topicos(3, 'A') }))
    expect(r.blocos.filter(b => b.tipo === 'estudo' && b.data === '2026-09-30').length).toBeGreaterThanOrEqual(2)
  })
})

describe('foco das questões do dia', () => {
  const g = (id: string, ordem: number): Topico => ({ id, nome: id, disciplineId: 'A', prioridade: 2, dificuldade: 2, ordem, grupo: 'Semana 1' })
  const titulo = (r: ReturnType<typeof gerarCronograma>, d: string) => r.blocos.find(b => b.tipo === 'questoes' && b.data === d)!.titulo
  it('usa as revisões do dia e os assuntos estudados na semana (mais recente primeiro)', () => {
    const r = gerarCronograma(base({ prova: '2026-12-15', topicos: [g('a', 0), g('b', 1), g('c', 2)], revisoesPorDia: { '2026-10-01': [{ nome: 'Pneumonia' }] } }))
    expect(titulo(r, '2026-09-30')).toBe('40 questões — a')
    expect(titulo(r, '2026-10-01')).toBe('40 questões — Pneumonia, b, a')
    expect(titulo(r, '2026-10-02')).toBe('40 questões — c, b, a')
  })
  it('só mostra até 3 assuntos e resume o resto', () => {
    const rev = ['R1', 'R2', 'R3', 'R4', 'R5'].map(nome => ({ nome }))
    expect(titulo(gerarCronograma(base({ topicos: [], revisoesPorDia: { '2026-10-01': rev } })), '2026-10-01')).toBe('40 questões — R1, R2, R3 e mais 2')
  })
  it('sem revisões nem assuntos na semana, cai na disciplina de maior peso', () => {
    expect(titulo(gerarCronograma(base({ topicos: [] })), '2026-10-01')).toBe('40 questões — Clínica')
  })
})

describe('assuntos fracos e atalho nas questões', () => {
  const q = (r: ReturnType<typeof gerarCronograma>, d: string) => r.blocos.find(b => b.tipo === 'questoes' && b.data === d)!
  it('um assunto fraco entra em dias alternados, em rodízio', () => {
    const r = gerarCronograma(base({ topicos: [], fracos: [{ id: 'w1', nome: 'Hipertensão', disciplineId: 'A' }, { id: 'w2', nome: 'Diabetes', disciplineId: 'A' }] }))
    expect(q(r, '2026-09-30').titulo).toBe('40 questões — Clínica')   // dia 0: sem foco, cai na disciplina
    expect(q(r, '2026-10-01').titulo).toBe('40 questões — Hipertensão')
    expect(q(r, '2026-10-02').titulo).toBe('40 questões — Clínica')
    expect(q(r, '2026-10-05').titulo).toBe('40 questões — Diabetes')
  })
  it('o primeiro assunto do foco vira o assunto da tarefa (para o atalho Registrar)', () => {
    const r = gerarCronograma(base({ topicos: [], revisoesPorDia: { '2026-10-01': [{ nome: 'Pneumonia', id: 'p1' }] } }))
    expect(q(r, '2026-10-01').topic_id).toBe('p1'); expect(q(r, '2026-09-30').topic_id).toBeNull()
  })
  it('revisão do dia vem antes do assunto fraco, e não repete nomes', () => {
    const r = gerarCronograma(base({ topicos: [], fracos: [{ id: 'w1', nome: 'Pneumonia', disciplineId: 'A' }], revisoesPorDia: { '2026-10-01': [{ nome: 'Pneumonia', id: 'p1' }] } }))
    expect(q(r, '2026-10-01').titulo).toBe('40 questões — Pneumonia')
  })
  it('a vinculação do bloco de questões não conta como assunto atrasado da semana', () => {
    const t: Topico = { id: 'a', nome: 'a', disciplineId: 'A', prioridade: 2, dificuldade: 2, ordem: 0, grupo: 'Semana 1' }
    expect(gerarCronograma(base({ topicos: [t] })).avisos.join(' ')).not.toMatch(/Semana 1/)
  })
})
