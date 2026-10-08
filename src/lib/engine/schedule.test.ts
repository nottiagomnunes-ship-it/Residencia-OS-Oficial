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
  it('semana com assuntos demais: um aviso só, com o ritmo pedido, o que cabe e até quando vai o plano', () => {
    const r = gerarCronograma(base({ prova: '2026-12-15', minutosDia: 90, topicos: Array.from({ length: 12 }, (_, i) => g('t' + i, 'Semana 1', i)) }))
    expect(r.avisos.join(' ')).toMatch(/pede cerca de 12 assuntos por semana, mas no seu tempo cabem cerca de \d+: o plano vai até \d{2}\/\d{2}\/2026 em vez de 04\/10\/2026/)
  })
  const semanas = (n: number, porSemana = 3) => Array.from({ length: n * porSemana }, (_, i) => g('t' + i, `Semana ${Math.floor(i / porSemana) + 1}`, i))
  const semanaDe = (r: ReturnType<typeof gerarCronograma>, id: string) => r.blocos.find(b => b.tipo === 'estudo' && b.topic_id === id)?.data
  it('mais semanas no cronograma do que até a prova: junta semanas seguidas, com a data ATUAL da prova', () => {
    const perto = gerarCronograma(base({ prova: '2026-12-15', topicos: semanas(20) })) // ~8 semanas até a reta final
    expect(perto.avisos.join(' ')).toMatch(/O cronograma tem 20 semanas e há \d+ até a reta final.*juntadas de \d em \d/)
    expect(semanaDe(perto, 't3')! <= '2026-10-04').toBe(true) // a "Semana 2" do cronograma já entra na primeira semana do plano
    const longe = gerarCronograma(base({ prova: '2027-09-15', topicos: semanas(20) })) // a mesma lista, prova mais distante
    expect(longe.avisos.join(' ')).not.toMatch(/juntadas/)
    expect(semanaDe(longe, 't3')! >= '2026-10-05').toBe(true) // sem juntar: a "Semana 2" fica na segunda semana
  })
  it('a ordem do cronograma é mantida ao juntar semanas', () => {
    const r = gerarCronograma(base({ prova: '2026-12-15', topicos: semanas(20) }))
    const datas = Array.from({ length: 60 }, (_, i) => semanaDe(r, 't' + i)).filter(Boolean) as string[]
    expect([...datas].sort()).toEqual(datas)
  })
  it('atraso pequeno (alguns dias) não gera aviso; só quando o plano passa mais de uma semana do previsto', () => {
    const r = gerarCronograma(base({ hoje: '2026-10-01', prova: '2027-09-15', topicos: semanas(10, 4) })) // quinta: a 1ª semana começa no meio
    expect(r.avisos.filter(a => /ritmo do cronograma/.test(a))).toHaveLength(0)
  })
  it('muitas semanas sem tempo para o ritmo: continua um aviso só (antes era um por semana)', () => {
    const r = gerarCronograma(base({ prova: '2027-09-15', minutosDia: 60, topicos: semanas(30, 8) }))
    expect(r.avisos.filter(a => /não couberam na semana/.test(a))).toHaveLength(0)
    expect(r.avisos.filter(a => /ritmo do cronograma|Faltam cerca de/.test(a))).toHaveLength(1) // ou o ritmo, ou as horas que faltam: nunca os dois
    const sobra = gerarCronograma(base({ prova: '2027-09-15', minutosDia: 90, topicos: semanas(10, 10) })) // ritmo alto, mas há semanas de sobra até a prova
    expect(sobra.naoAlocados).toBe(0); expect(sobra.avisos.filter(a => /ritmo do cronograma/.test(a))).toHaveLength(1)
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
    expect(titulo(r, '2026-10-01')).toBe('40 questões — Pneumonia')
    expect(titulo(r, '2026-10-02')).toBe('40 questões — c')
  })
  it('com várias revisões no mesmo dia, o bloco fica com um assunto só', () => {
    const rev = ['R1', 'R2', 'R3', 'R4', 'R5'].map(nome => ({ nome }))
    expect(titulo(gerarCronograma(base({ topicos: [], revisoesPorDia: { '2026-10-01': rev } })), '2026-10-01')).toBe('40 questões — R1')
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

describe('um bloco de questões, um assunto', () => {
  const t = (id: string, ordem: number): Topico => ({ id, nome: id, disciplineId: 'A', prioridade: 2, dificuldade: 2, ordem, grupo: 'Semana 1' })
  const blocosQ = (r: ReturnType<typeof gerarCronograma>) => r.blocos.filter(b => b.tipo === 'questoes')
  it('nenhum bloco junta vários assuntos, e o assunto do título é o assunto da tarefa', () => {
    const r = gerarCronograma(base({ prova: '2026-12-15', topicos: [t('a', 0), t('b', 1), t('c', 2)], revisoesPorDia: { '2026-10-01': [{ nome: 'Pneumonia', id: 'p1' }, { nome: 'Asma', id: 'p2' }] }, fracos: [{ id: 'w1', nome: 'HAS', disciplineId: 'A' }] }))
    for (const b of blocosQ(r)) { expect(b.titulo).not.toMatch(/,| e mais /); expect(b.titulo.split(' — ').length).toBe(2) }
    expect(blocosQ(r).find(b => b.data === '2026-10-01')).toMatchObject({ titulo: '40 questões — Pneumonia', topic_id: 'p1' })
  })
  it('os assuntos da semana se revezam, um por bloco, sem repetir até todos terem a vez', () => {
    const r = gerarCronograma(base({ prova: '2026-12-15', topicos: [t('a', 0), t('b', 1), t('c', 2)] }))
    expect(blocosQ(r).filter(b => b.data <= '2026-10-02').map(b => b.titulo)).toEqual(['40 questões — a', '40 questões — b', '40 questões — c'])
  })
  it('quando todos já tiveram a vez, o rodízio recomeça', () => {
    const r = gerarCronograma(base({ prova: '2026-12-15', topicos: [t('a', 0), t('b', 1)] }))
    expect(blocosQ(r).filter(b => b.data <= '2026-10-02').map(b => b.titulo)).toEqual(['40 questões — a', '40 questões — b', '40 questões — b'])
  })
})

describe('tempo disponível por dia (sem horários)', () => {
  const dia = (r: ReturnType<typeof gerarCronograma>, d: string) => r.blocos.filter(b => b.data === d)
  const total = (l: { duracao_min: number }[]) => l.reduce((s, b) => s + b.duracao_min, 0)
  const topicos30 = Array.from({ length: 30 }, (_, i) => ({ id: 'T' + i, nome: 'T' + i, disciplineId: 'A', prioridade: 2, dificuldade: 2 }))
  it('nenhuma tarefa tem horário de relógio; cada dia numera as tarefas na ordem de prioridade (estudo antes das questões)', () => {
    const r = gerarCronograma(base({ prova: '2026-12-15', topicos: topicos30 }))
    expect(r.blocos.every(b => b.hora_ini === undefined && b.hora_fim === undefined)).toBe(true)
    const d = dia(r, '2026-10-01'); expect(d.map(b => b.ordem_dia)).toEqual(d.map((_, k) => k + 1)); expect(d.at(-1)!.tipo).toBe('questoes')
  })
  it('o dia nunca passa do tempo informado, e o bloco de questões encolhe junto', () => {
    const r = gerarCronograma(base({ prova: '2026-12-15', topicos: topicos30, capacidadePorDia: { '2026-10-01': 60, '2026-10-02': 120, '2026-10-05': 240 } }))
    expect(total(dia(r, '2026-10-01'))).toBeLessThanOrEqual(60); expect(total(dia(r, '2026-10-02'))).toBeLessThanOrEqual(120)
    expect(dia(r, '2026-10-01').find(b => b.tipo === 'questoes')?.qtd_questoes).toBe(10)   // 1 h: 10 questões, não 40
    expect(dia(r, '2026-10-02').find(b => b.tipo === 'questoes')?.qtd_questoes).toBe(20)
    expect(dia(r, '2026-10-05').find(b => b.tipo === 'questoes')?.qtd_questoes).toBe(40)
  })
  it('"sem tempo" (zero) deixa o dia vazio; dia com tempo informado vale mesmo fora dos dias disponíveis', () => {
    const r = gerarCronograma(base({ prova: '2026-12-15', topicos: topicos30, capacidadePorDia: { '2026-10-01': 0, '2026-10-03': 120 } })) // 03/10 é sábado
    expect(dia(r, '2026-10-01')).toHaveLength(0); expect(dia(r, '2026-10-03').length).toBeGreaterThan(0)
  })
  it('pouco tempo (30 min) não cria bloco de questões inútil', () => {
    const r = gerarCronograma(base({ prova: '2026-12-15', topicos: topicos30, capacidadePorDia: { '2026-10-01': 30 } }))
    expect(dia(r, '2026-10-01').some(b => b.tipo === 'questoes')).toBe(false)
  })
})

import { duracaoTopico, parteDoTitulo, MIN_ASSUNTO, primeiraDataPorAssunto } from './schedule'
describe('assunto com tempo mínimo de 60 min (dia curto = assunto em partes)', () => {
  const t = (id: string, ordem: number, dificuldade = 2): Topico => ({ id, nome: 'Assunto ' + id, disciplineId: 'A', prioridade: 2, dificuldade, ordem })
  const estudos = (r: ReturnType<typeof gerarCronograma>, id: string) => r.blocos.filter(b => b.tipo === 'estudo' && b.topic_id === id)
  it('duração: nunca abaixo de 60 min (o fácil também vale 60); reforço continua 45', () => {
    expect(MIN_ASSUNTO).toBe(60)
    expect(duracaoTopico(t('a', 0, 1))).toBe(60); expect(duracaoTopico(t('a', 0, 2))).toBe(60); expect(duracaoTopico(t('a', 0, 3))).toBe(75)
    expect(duracaoTopico({ ...t('r', 0), reforco: true })).toBe(45)
  })
  it('com 30 min por dia, o assunto NÃO é encolhido: vira duas partes de 30 em dias diferentes', () => {
    const r = gerarCronograma(base({ minutosDia: 30, questoesDia: 0, topicos: [t('a', 0), t('b', 1)] }))
    const a = estudos(r, 'a')
    expect(a.map(b => b.duracao_min)).toEqual([30, 30])
    expect(a.map(b => b.titulo)).toEqual(['Assunto a (parte 1 de 2)', 'Assunto a (parte 2 de 2)'])
    expect(new Set(a.map(b => b.data)).size).toBe(2)
    expect(estudos(r, 'b')[0].data > a[1].data).toBe(true) // o seguinte só começa depois
  })
  it('a soma das partes é sempre a duração inteira do assunto', () => {
    for (const min of [30, 45, 60, 90, 120]) {
      const r = gerarCronograma(base({ minutosDia: min, topicos: [t('a', 0, 3), t('b', 1, 4), t('c', 2, 1)] }))
      for (const id of ['a', 'b', 'c']) {
        const total = estudos(r, id).reduce((s, b) => s + b.duracao_min, 0)
        expect(total, `${min} min, ${id}`).toBe(duracaoTopico(t(id, 0, id === 'a' ? 3 : id === 'b' ? 4 : 1)))
      }
    }
  })
  it('dia com tempo de sobra: o assunto entra inteiro, sem "parte"', () => {
    const r = gerarCronograma(base({ minutosDia: 240, topicos: [t('a', 0, 3)] }))
    expect(estudos(r, 'a')).toHaveLength(1); expect(estudos(r, 'a')[0].titulo).toBe('Assunto a'); expect(estudos(r, 'a')[0].duracao_min).toBe(75)
  })
  it('não trava quando nenhuma divisão deixa as duas partes com 30+ min (faltam 45, o dia tem 30)', () => {
    const r = gerarCronograma(base({ minutosDia: 30, questoesDia: 0, topicos: [t('a', 0, 3), t('b', 1)] })) // 75 = 30 + 30 + 15
    expect(estudos(r, 'a').map(b => b.duracao_min)).toEqual([30, 30, 15])
    expect(estudos(r, 'b').length).toBeGreaterThan(0)
  })
  it('assunto começado em partes: o gerador só agenda o que falta', () => {
    const r = gerarCronograma(base({ minutosDia: 240, topicos: [{ ...t('a', 0, 3), feitoMin: 30 }] }))
    expect(estudos(r, 'a').map(b => b.duracao_min)).toEqual([45])
  })
  it('lê a parte no título', () => {
    expect(parteDoTitulo('Pré-eclâmpsia (parte 1 de 2)')).toEqual({ parte: 1, de: 2 })
    expect(parteDoTitulo('HAS (Parte 1)')).toBeNull() // "(Parte 1)" faz parte do nome do assunto, não é divisão
    expect(parteDoTitulo('Imunizações')).toBeNull(); expect(parteDoTitulo(null)).toBeNull()
  })
})
it('data planejada de um assunto em partes é a da parte 1', () => {
  expect(primeiraDataPorAssunto([{ topic_id: 'a', data: '2026-10-09' }, { topic_id: 'b', data: '2026-10-08' }, { topic_id: 'a', data: '2026-10-07' }, { topic_id: null, data: '2026-10-01' }]))
    .toEqual([{ id: 'a', data: '2026-10-07' }, { id: 'b', data: '2026-10-08' }])
})
