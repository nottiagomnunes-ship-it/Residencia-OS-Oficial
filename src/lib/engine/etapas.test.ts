import { it, expect, describe } from 'vitest'
import { progressoEtapas, tituloPadrao, MODELO_PADRAO, PADRAO_REVISAO, TIPOS_ETAPA, MODELOS_INICIAIS, validarEtapa, selecionarAssuntos, itensParaAdicionar, ultimoLote, podeDesfazer, minutosRestantes } from './etapas'

it('progresso das etapas', () => {
  expect(progressoEtapas([])).toEqual({ feitas: 0, total: 0, pct: 0, completo: false })
  expect(progressoEtapas([{ concluida: true }, { concluida: false }, { concluida: true }, { concluida: true }])).toMatchObject({ feitas: 3, pct: 75, completo: false })
  expect(progressoEtapas([{ concluida: true }]).completo).toBe(true)
})
it('títulos padrão por tipo', () => {
  expect(tituloPadrao('video')).toBe('Assistir à videoaula'); expect(tituloPadrao('questoes', 40)).toBe('Fazer 40 questões')
  expect(tituloPadrao('questoes')).toBe('Fazer questões'); expect(tituloPadrao('outro')).toBe('')
})
it('modelo padrão: videoaula, leitura e 30 questões', () => { expect(MODELO_PADRAO.map(m => m.tipo)).toEqual(['video', 'leitura', 'questoes']); expect(MODELO_PADRAO[2].qtd_questoes).toBe(30) })

it('padrões iniciais: o conjunto padrão é o trio de antes e há opções extras', () => {
  expect(MODELOS_INICIAIS.filter(m => m.conjunto).map(m => m.tipo)).toEqual(MODELO_PADRAO.map(m => m.tipo))
  expect(MODELOS_INICIAIS.length).toBeGreaterThan(MODELO_PADRAO.length); expect(MODELOS_INICIAIS.some(m => !m.conjunto)).toBe(true)
})
it('validação de etapa/padrão', () => {
  expect(validarEtapa('questoes', '  Fazer 20 questões  ', 20)).toEqual({ tipo: 'questoes', titulo: 'Fazer 20 questões', qtd: 20 })
  expect(validarEtapa('video', 'Assistir', 30)).toEqual({ tipo: 'video', titulo: 'Assistir', qtd: null }) // nº de questões só vale para questões
  expect(validarEtapa('outro', '   ', null)).toHaveProperty('erro'); expect(validarEtapa('xyz', 'a', null)).toHaveProperty('erro')
  expect(validarEtapa('questoes', 'a', 0)).toHaveProperty('erro'); expect(validarEtapa('questoes', 'a', 1001)).toHaveProperty('erro')
  expect(validarEtapa('questoes', 'Refazer erradas', null)).toMatchObject({ qtd: null })
})

describe('aplicar etapas em lote', () => {
  const ts = [
    { id: 'a', status: 'nao_iniciado', grupo: 'Semana 1', discipline_id: 'D1' }, { id: 'b', status: 'planejado', grupo: 'Semana 1', discipline_id: 'D2' },
    { id: 'c', status: 'nao_iniciado', grupo: 'Semana 2', discipline_id: 'D1' }, { id: 'd', status: 'concluido', grupo: 'Semana 1', discipline_id: 'D1' },
    { id: 'e', status: 'em_andamento', grupo: null, discipline_id: 'D2' },
  ]
  const com = { b: 3, e: 1 }
  it('"sem etapas": só quem não tem, e nunca concluídos', () => { expect(selecionarAssuntos(ts, com, 'sem_etapas', true)).toEqual(['a', 'c']) })
  it('por semana e por disciplina', () => {
    expect(selecionarAssuntos(ts, {}, 'g:Semana 1', false)).toEqual(['a', 'b'])     // o concluído (d) fica de fora
    expect(selecionarAssuntos(ts, com, 'g:Semana 1', true)).toEqual(['a'])           // pular quem já tem etapas
    expect(selecionarAssuntos(ts, {}, 'd:D2', false)).toEqual(['b', 'e'])
  })
  it('"todos": respeita o pular e exclui concluídos', () => {
    expect(selecionarAssuntos(ts, com, 'todos', false)).toEqual(['a', 'b', 'c', 'e']); expect(selecionarAssuntos(ts, com, 'todos', true)).toEqual(['a', 'c'])
  })
  it('não duplica o que o assunto já tem (sem diferenciar acento ou maiúscula)', () => {
    const itens = [{ tipo: 'video', titulo: 'Assistir à videoaula' }, { tipo: 'leitura', titulo: 'Ler o material' }]
    expect(itensParaAdicionar(itens, [{ tipo: 'video', titulo: 'assistir a videoaula' }])).toEqual([itens[1]])
    expect(itensParaAdicionar(itens, [{ tipo: 'leitura', titulo: 'Assistir à videoaula' }])).toEqual(itens) // tipo diferente não conta
  })
})

describe('desfazer o último lote', () => {
  const r = (lote_id: string, created_at: string, topic_id: string, concluida = false) => ({ lote_id, created_at, topic_id, concluida })
  it('sem lotes não há o que desfazer', () => { expect(ultimoLote([])).toBeNull() })
  it('escolhe o lote da etapa mais recente e resume o lote inteiro', () => {
    const u = ultimoLote([r('A', '2026-10-01T10:00:00Z', 't1'), r('B', '2026-10-02T09:00:00Z', 't1'), r('B', '2026-10-02T09:00:01Z', 't2', true), r('B', '2026-10-02T09:00:01Z', 't2')])
    expect(u).toEqual({ id: 'B', em: '2026-10-02T09:00:00Z', etapas: 3, assuntos: 2, concluidas: 1 })
  })
  it('depois de desfeito, o lote anterior passa a ser o último', () => {
    expect(ultimoLote([r('A', '2026-10-01T10:00:00Z', 't1')])?.id).toBe('A')
  })
})

describe('limite de 24 h para desfazer', () => {
  const em = '2026-10-02T09:00:00Z', t0 = Date.parse(em), h = 3_600_000
  it('vale até 24 h depois de aplicado, inclusive; passou disso, não', () => {
    expect(podeDesfazer(em, t0 + 23.9 * h)).toBe(true); expect(podeDesfazer(em, t0 + 24 * h)).toBe(true)
    expect(podeDesfazer(em, t0 + 24 * h + 1)).toBe(false); expect(podeDesfazer(em, t0 + 72 * h)).toBe(false)
  })
  it('data inválida nunca pode ser desfeita', () => { expect(podeDesfazer('não é data')).toBe(false) })
  it('minutos restantes', () => { expect(minutosRestantes(em, t0 + 23 * h)).toBe(60); expect(minutosRestantes(em, t0)).toBe(1440); expect(minutosRestantes(em, t0 + 25 * h)).toBe(0) })
})

describe('padrão de cada revisão', () => {
  it('três itens válidos, nenhum marcado de saída e sem repetir título', () => {
    expect(PADRAO_REVISAO).toHaveLength(3)
    for (const m of PADRAO_REVISAO) { expect(m.tipo in TIPOS_ETAPA).toBe(true); expect(m.titulo.length).toBeGreaterThan(0) }
    expect(new Set(PADRAO_REVISAO.map(m => m.titulo)).size).toBe(3)
    expect(PADRAO_REVISAO.find(m => m.qtd_questoes)).toMatchObject({ tipo: 'questoes', qtd_questoes: 10 })
  })
})
