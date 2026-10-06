import { describe, it, expect } from 'vitest'
import { montarBackup, TABELAS_BACKUP } from './exportar'
import { validarBackup, prepararRestauracao, compararContagens, avisosDaPrevia, CAMPOS_DO_PERFIL, ORDEM_INSERCAO, OBRIGATORIAS_NO_ARQUIVO, type Backup } from './restauracao'

// um backup realista, montado pelo MESMO código que exporta (assim o formato não desvia)
const D = '00000000-0000-0000-0000-0000000000d1', T1 = '00000000-0000-0000-0000-0000000000a1', T2 = '00000000-0000-0000-0000-0000000000a2'
const ST = '00000000-0000-0000-0000-0000000000b1', RV = '00000000-0000-0000-0000-0000000000c1', MK = '00000000-0000-0000-0000-0000000000e1', QS = '00000000-0000-0000-0000-0000000000f1', QA = '00000000-0000-0000-0000-000000000f11'
const dados = (): Record<string, any[]> => ({
  disciplines: [{ id: D, user_id: 'u', nome: 'Clínica' }],
  topics: [{ id: T1, user_id: 'u', discipline_id: D, nome: 'Asma', status: 'concluido' }, { id: T2, user_id: 'u', discipline_id: D, nome: 'DM', status: 'planejado' }],
  topic_tasks: [{ id: 'k1', user_id: 'u', topic_id: T1, titulo: 'Videoaula', lote_id: 'LOTE-1' }, { id: 'k2', user_id: 'u', topic_id: T2, titulo: 'Leitura', lote_id: 'LOTE-1' }],
  review_tasks: [{ id: 'rt1', user_id: 'u', review_id: RV, titulo: 'Reler' }],
  etapa_modelos: [{ id: 'em1', user_id: 'u', titulo: 'Padrão' }],
  study_sessions: [{ id: ST, user_id: 'u', topic_id: T1, duration_min: 45 }],
  reviews: [{ id: RV, user_id: 'u', topic_id: T1, origem_session_id: ST, numero: 1 }],
  mock_exams: [{ id: MK, user_id: 'u', nome: 'Simulado 1' }],
  question_sets: [{ id: QS, user_id: 'u', discipline_id: D, topic_id: T1, mock_exam_id: MK, total: 40 }],
  question_answers: [{ id: QA, user_id: 'u', question_set_id: QS, correta: false }],
  error_notebook: [{ id: 'en1', user_id: 'u', discipline_id: D, topic_id: T1, question_answer_id: QA }],
  schedule_items: [{ id: 's1', user_id: 'u', topic_id: T2, review_id: null, titulo: 'DM' }, { id: 's2', user_id: 'u', topic_id: T1, review_id: RV, titulo: 'Revisão D1' }, { id: 's3', user_id: 'u', topic_id: null, review_id: null, titulo: 'Manual' }],
  goals: [{ id: 'g1', user_id: 'u', metrica: 'questoes', alvo: 100 }], achievements: [{ id: 'ac1', user_id: 'u', codigo: 'primeiro_passo' }],
  daily_stats: [{ user_id: 'u', data: '2026-10-01', minutos: 60 }], commitments: [], capacidade_dia: [{ user_id: 'u', data: '2026-10-05', minutos: 120 }],
})
const perfil = { id: 'u', nome: 'Tiago', onboarded: true, exam_date: '2026-12-15', daily_minutes: 120, xp: 1600, level: 4, lembrete_email: true, lembrete_aviso: 'x', rank_visto: 9, plano_gerado_em: '2026-10-01T10:00:00Z', ritmo_modo: 'resumo' }
const arquivo = () => JSON.parse(JSON.stringify(montarBackup(perfil, dados(), 'tiago@x.com', '2026-10-01T12:00:00.000Z')))
const ok = (v: any) => { expect(v.ok).toBe(true); return v }

describe('validarBackup: o que é aceito', () => {
  it('aceita o arquivo gerado pelo próprio exportador, completo', () => {
    const v = ok(validarBackup(arquivo())); expect(v.presentes.length).toBe(17); expect(v.avisos).toEqual([]); expect(v.contagem.topics).toBe(2)
  })
  it('backup feito com o nome antigo do app (Residência OS) continua valendo; o novo sai como R1TMO', () => {
    expect(arquivo().app).toBe('R1TMO')
    ok(validarBackup({ ...arquivo(), app: 'Residência OS' }))
  })
  it('backup de uma versão antiga (sem etapas das revisões e tempo por dia): aceita e avisa o que fica como está', () => {
    const a = arquivo(); delete a.tabelas.review_tasks; delete a.tabelas.capacidade_dia
    const v = ok(validarBackup(a)); expect(v.ausentes).toEqual(['review_tasks', 'capacidade_dia']); expect(v.avisos[0]).toContain('versão mais antiga'); expect(v.avisos[0]).toContain('fica como está')
  })
  it('partes desconhecidas são ignoradas com aviso (não quebram)', () => {
    const a = arquivo(); a.tabelas.tabela_do_futuro = [{ id: 'x' }]; const v = ok(validarBackup(a)); expect(v.ignoradas).toEqual(['tabela_do_futuro']); expect(v.backup.tabelas.tabela_do_futuro).toBeUndefined(); expect(v.avisos.join(' ')).toContain('tabela_do_futuro')
  })
  it('conta de um usuário novo (tabelas vazias) é um backup válido', () => {
    const vazio = montarBackup(null, Object.fromEntries(TABELAS_BACKUP.map(t => [t, []])), undefined, '2026-10-01T00:00:00Z'); ok(validarBackup(JSON.parse(JSON.stringify(vazio))))
  })
  it('quantidades que não batem com o conteúdo geram aviso (arquivo possivelmente editado), mas não bloqueiam', () => {
    const a = arquivo(); a.contagem.topics = 99; expect(ok(validarBackup(a)).avisos.join(' ')).toContain('editado')
  })
})

describe('validarBackup: o que é recusado, com mensagem clara', () => {
  const erro = (x: unknown) => { const v = validarBackup(x); expect(v.ok).toBe(false); return (v as any).erro as string }
  it('não é um backup', () => {
    for (const x of [null, 'texto', 42, [], {}, { app: 'Outro app', versao: 1, tabelas: {} }]) expect(erro(x)).toMatch(/backup/)
  })
  it('versão mais nova do app, ou sem versão', () => {
    expect(erro({ ...arquivo(), versao: 2 })).toContain('versão mais nova'); expect(erro({ ...arquivo(), versao: undefined })).toContain('versão'); expect(erro({ ...arquivo(), versao: 0 })).toContain('versão')
  })
  it('sem tabelas, tabela que não é lista, linha que não é objeto', () => {
    expect(erro({ ...arquivo(), tabelas: undefined })).toContain('tabelas')
    const a = arquivo(); a.tabelas.topics = 'oops'; expect(erro(a)).toContain('Assuntos')
    const b = arquivo(); b.tabelas.goals = [1, 2]; expect(erro(b)).toContain('Metas')
  })
  it('backup incompleto: lista o que falta (não restaura pela metade)', () => {
    const a = arquivo(); delete a.tabelas.disciplines; delete a.tabelas.reviews
    const e = erro(a); expect(e).toContain('incompleto'); expect(e).toContain('Disciplinas'); expect(e).toContain('Revisões')
  })
  it('ids repetidos ou ausentes', () => {
    const a = arquivo(); a.tabelas.topics[1].id = a.tabelas.topics[0].id; expect(erro(a)).toContain('repetidas')
    const b = arquivo(); delete b.tabelas.disciplines[0].id; expect(erro(b)).toContain('sem identificador')
  })
  it('perfil em formato inválido', () => { expect(erro({ ...arquivo(), perfil: 'x' })).toContain('perfil') })
  it('tamanho absurdo é recusado', () => {
    const a = arquivo(); a.tabelas.schedule_items = Array.from({ length: 200_001 }, (_, i) => ({ id: 'i' + i })); expect(erro(a)).toContain('linhas demais')
  })
})

describe('prepararRestauracao: ids novos e ligações refeitas', () => {
  const prep = () => { let n = 0; return prepararRestauracao(ok(validarBackup(arquivo())).backup as Backup, () => `novo-${++n}`) }
  it('nenhum id original sobra e todos os novos são únicos', () => {
    const p = prep(), ids = Object.entries(p.dados).filter(([t]) => !['daily_stats', 'capacidade_dia'].includes(t)).flatMap(([, l]) => l.map(r => r.id))
    expect(new Set(ids).size).toBe(ids.length); for (const i of ids) expect(i).toMatch(/^novo-/)
  })
  it('as ligações apontam para os ids NOVOS, em todas as tabelas', () => {
    const p = prep(), id = (t: string, k = 0) => p.dados[t][k].id
    expect(p.dados.topics[0].discipline_id).toBe(id('disciplines')); expect(p.dados.topics[1].discipline_id).toBe(id('disciplines'))
    expect(p.dados.reviews[0].topic_id).toBe(id('topics', 0)); expect(p.dados.reviews[0].origem_session_id).toBe(id('study_sessions'))
    expect(p.dados.review_tasks[0].review_id).toBe(id('reviews')); expect(p.dados.question_sets[0].mock_exam_id).toBe(id('mock_exams')); expect(p.dados.question_sets[0].topic_id).toBe(id('topics', 0))
    expect(p.dados.question_answers[0].question_set_id).toBe(id('question_sets')); expect(p.dados.error_notebook[0].question_answer_id).toBe(id('question_answers'))
    expect(p.dados.schedule_items[0].topic_id).toBe(id('topics', 1)); expect(p.dados.schedule_items[1].review_id).toBe(id('reviews'))
  })
  it('ligações vazias continuam vazias (tarefa manual, sem assunto)', () => { const s = prep().dados.schedule_items[2]; expect(s.topic_id).toBeNull(); expect(s.review_id).toBeNull() })
  it('o identificador de lote das etapas é mantido (agrupa as etapas aplicadas juntas)', () => { const t = prep().dados.topic_tasks; expect(t[0].lote_id).toBe('LOTE-1'); expect(t[1].lote_id).toBe('LOTE-1') })
  it('tabelas de chave composta (dia) não ganham id, e o user_id nunca passa', () => {
    const p = prep(); expect(p.dados.daily_stats[0]).toEqual({ data: '2026-10-01', minutos: 60 }); expect(p.dados.capacidade_dia[0]).not.toHaveProperty('id')
    for (const l of Object.values(p.dados)) for (const r of l) expect(r).not.toHaveProperty('user_id')
  })
  it('só devolve as tabelas que estavam no arquivo (as ausentes não serão apagadas)', () => {
    const a = arquivo(); delete a.tabelas.capacidade_dia; delete a.tabelas.review_tasks
    const p = prepararRestauracao(ok(validarBackup(a)).backup as Backup, () => 'x'); expect('capacidade_dia' in p.dados).toBe(false); expect('review_tasks' in p.dados).toBe(false); expect('topics' in p.dados).toBe(true)
  })
  it('perfil: só as configurações permitidas (nada de e-mail do lembrete, avisos ou marcas internas)', () => {
    const pf = prep().perfil!
    expect(pf).toEqual({ nome: 'Tiago', exam_date: '2026-12-15', daily_minutes: 120, xp: 1600, level: 4, ritmo_modo: 'resumo' })
    for (const proibido of ['id', 'onboarded', 'lembrete_email', 'lembrete_aviso', 'rank_visto', 'plano_gerado_em']) expect(pf).not.toHaveProperty(proibido)
  })
  it('a ordem de inserção respeita as dependências (cada tabela só depende das anteriores)', () => {
    const pos = (t: string) => ORDEM_INSERCAO.indexOf(t as any)
    for (const [filho, pai] of [['topics', 'disciplines'], ['reviews', 'topics'], ['reviews', 'study_sessions'], ['review_tasks', 'reviews'], ['topic_tasks', 'topics'], ['question_sets', 'mock_exams'], ['question_answers', 'question_sets'], ['error_notebook', 'question_answers'], ['schedule_items', 'reviews']]) expect(pos(filho)).toBeGreaterThan(pos(pai))
    expect([...ORDEM_INSERCAO].sort()).toEqual([...TABELAS_BACKUP].sort())     // todas as tabelas do backup, nem mais nem menos
    expect(OBRIGATORIAS_NO_ARQUIVO.length).toBe(15)
  })
})

describe('prepararRestauracao: referências quebradas (arquivo consistente de verdade nunca tem, mas não pode estourar)', () => {
  it('"pai" obrigatório ausente: a linha e os seus filhos saem, e é contado', () => {
    const a = arquivo(); a.tabelas.topics = a.tabelas.topics.filter((t: any) => t.id !== T1)       // sumiu o assunto Asma
    const p = prepararRestauracao(ok(validarBackup(a)).backup as Backup, () => crypto.randomUUID())
    expect(p.dados.topics.length).toBe(1); expect(p.dados.reviews.length).toBe(0); expect(p.dados.review_tasks.length).toBe(0); expect(p.dados.topic_tasks.length).toBe(1)
    expect(p.descartadas).toMatchObject({ reviews: 1, review_tasks: 1, topic_tasks: 1 })
  })
  it('"pai" opcional ausente: a ligação vira vazia e a linha fica', () => {
    const a = arquivo(); a.tabelas.mock_exams = []
    const p = prepararRestauracao(ok(validarBackup(a)).backup as Backup, () => crypto.randomUUID())
    expect(p.dados.question_sets.length).toBe(1); expect(p.dados.question_sets[0].mock_exam_id).toBeNull(); expect(p.descartadas.question_sets).toBeUndefined()
  })
  it('disciplina ausente derruba os assuntos (a ligação é obrigatória) e tudo o que depende deles', () => {
    const a = arquivo(); a.tabelas.disciplines = []
    const p = prepararRestauracao(ok(validarBackup(a)).backup as Backup, () => crypto.randomUUID())
    expect(p.dados.topics.length).toBe(0); expect(p.dados.reviews.length).toBe(0); expect(p.dados.topic_tasks.length).toBe(0); expect(p.descartadas.topics).toBe(2)
  })
})

describe('comparar e avisar antes de confirmar', () => {
  it('lado a lado, com o sentido da mudança', () => {
    const c = compararContagens({ topics: 100, goals: 3, achievements: 5, capacidade_dia: 4 }, { topics: 120, goals: 3, achievements: 2, capacidade_dia: 0, schedule_items: 50 })
    const por = Object.fromEntries(c.map(x => [x.tabela, x])); expect(por.topics).toMatchObject({ backup: 100, atual: 120, mudanca: 'menos' }); expect(por.goals.mudanca).toBe('igual'); expect(por.achievements.mudanca).toBe('mais')
    expect(por.schedule_items).toMatchObject({ backup: null, atual: 50, mudanca: 'fica' }); expect(c.length).toBe(17)
  })
  it('avisa de backup antigo e de progresso que seria desfeito', () => {
    const a = avisosDaPrevia({ exportadoEm: '2026-09-20T10:00:00Z', hoje: '2026-10-02', concluidosBackup: 20, concluidosAtual: 35 })
    expect(a.join(' ')).toContain('12 dias'); expect(a.join(' ')).toContain('20 assuntos concluídos'); expect(a.join(' ')).toContain('35')
    expect(avisosDaPrevia({ exportadoEm: '2026-10-01T10:00:00Z', hoje: '2026-10-02', concluidosBackup: 35, concluidosAtual: 35 })).toEqual([])
    expect(avisosDaPrevia({ exportadoEm: null, hoje: '2026-10-02', concluidosBackup: 0, concluidosAtual: 0 })[0]).toContain('não informa a data')
  })
  it('a lista de campos do perfil não inclui nada operacional', () => { for (const c of CAMPOS_DO_PERFIL) expect(c).not.toMatch(/lembrete|_visto|plano_|capacidade_alterada|semana_aviso|onboarded|^id$/) })
})
