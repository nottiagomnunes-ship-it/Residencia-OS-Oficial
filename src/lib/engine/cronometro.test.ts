import { describe, it, expect } from 'vitest'
import { segundosDecorridos, formatarRelogio, minutosParaRegistrar, pareceEsquecido, progressoPlanejado, opcoesDeFinalizar, destinoDoRegistro, xpPrevisto, LIMITE_SESSAO_MIN } from './cronometro'

const T0 = Date.parse('2026-10-05T10:00:00Z')
const rodando = { acumulado_seg: 0, iniciado_em: '2026-10-05T10:00:00Z', pausado: false }

describe('contagem do tempo', () => {
  it('rodando: o trecho atual mais o que já foi acumulado', () => {
    expect(segundosDecorridos(rodando, T0 + 90_000)).toBe(90)
    expect(segundosDecorridos({ ...rodando, acumulado_seg: 600 }, T0 + 5 * 60_000)).toBe(900)    // 10 min antes da pausa + 5 min agora
  })
  it('pausado: só o acumulado, mesmo que o tempo passe', () => { expect(segundosDecorridos({ acumulado_seg: 600, iniciado_em: '2026-10-05T10:00:00Z', pausado: true }, T0 + 3_600_000)).toBe(600) })
  it('um relógio do aparelho atrasado ou adiantado nunca dá tempo negativo', () => { expect(segundosDecorridos(rodando, T0 - 30_000)).toBe(0) })
})

describe('formatar o relógio', () => {
  it('mm:ss e h:mm:ss', () => { expect([0, 59, 754, 3599, 3600, 3725, 36000].map(formatarRelogio)).toEqual(['00:00', '00:59', '12:34', '59:59', '1:00:00', '1:02:05', '10:00:00']) })
})

describe('minutos a registrar', () => {
  it('arredonda ao minuto mais próximo, mínimo 1', () => {
    expect([10, 29, 30, 89, 90, 2820].map(s => minutosParaRegistrar(s).minutos)).toEqual([1, 1, 1, 1, 2, 47])
  })
  it('passou de 4 h: corta em 4 h e avisa (quase sempre foi esquecimento)', () => {
    expect(minutosParaRegistrar(4 * 3600)).toEqual({ minutos: 240, passouDoLimite: false })
    expect(minutosParaRegistrar(4 * 3600 + 120)).toEqual({ minutos: LIMITE_SESSAO_MIN, passouDoLimite: true })
    expect(minutosParaRegistrar(9 * 3600).passouDoLimite).toBe(true)
  })
  it('a barra pergunta se esqueceu a partir de 3 h', () => { expect(pareceEsquecido(3 * 3600 - 1)).toBe(false); expect(pareceEsquecido(3 * 3600)).toBe(true) })
})

describe('progresso da duração planejada', () => {
  it('em % e sem passar de 100; sem duração planejada, nada', () => {
    expect(progressoPlanejado(1800, 60)).toBe(50); expect(progressoPlanejado(7200, 60)).toBe(100)
    expect(progressoPlanejado(1800, null)).toBeNull(); expect(progressoPlanejado(1800, 0)).toBeNull()
  })
})

describe('o que se pode fazer ao finalizar', () => {
  const ids = (c: any, m = 47) => opcoesDeFinalizar(c, m).map(o => o.id)
  it('estudo com assunto: concluir (XP real, gera revisões) ou só o tempo', () => {
    const o = opcoesDeFinalizar({ tipo: 'estudo', topic_id: 't', review_id: null }, 47)
    expect(o.map(x => x.id)).toEqual(['concluir', 'tempo']); expect(o[0].rotulo).toBe('Concluir o assunto'); expect(o[0].detalhe).toContain('47 min'); expect(o[0].detalhe).toContain('+34 XP'); expect(o[0].detalhe).toContain('revisões')
  })
  it('estudo sem assunto (reforço): concluir a tarefa, sem falar de revisões', () => {
    const o = opcoesDeFinalizar({ tipo: 'estudo', topic_id: null, review_id: null }, 60)
    expect(o[0].rotulo).toBe('Concluir a tarefa'); expect(o[0].detalhe).not.toContain('revisões'); expect(o[0].detalhe).toContain('+36 XP')
  })
  it('revisão: concluir (+15 XP), registrar o resultado ou só o tempo; sem a revisão, só o tempo', () => {
    expect(ids({ tipo: 'revisao', topic_id: 't', review_id: 'r' })).toEqual(['concluir', 'registrar', 'tempo'])
    expect(opcoesDeFinalizar({ tipo: 'revisao', topic_id: 't', review_id: 'r' }, 30)[0].detalhe).toContain('+15 XP')
    expect(ids({ tipo: 'revisao', topic_id: 't', review_id: null })).toEqual(['tempo'])
  })
  it('questões e simulado NUNCA concluem direto: levam ao registro, onde está o resultado', () => {
    expect(ids({ tipo: 'questoes', topic_id: null, review_id: null })).toEqual(['registrar', 'tempo'])
    expect(ids({ tipo: 'simulado', topic_id: null, review_id: null })).toEqual(['registrar', 'tempo'])
  })
  it('flashcards concluem sem XP; estudo livre só registra o tempo', () => {
    expect(ids({ tipo: 'flashcards', topic_id: null, review_id: null })).toEqual(['concluir', 'tempo'])
    expect(opcoesDeFinalizar({ tipo: 'flashcards', topic_id: null, review_id: null }, 20)[0].detalhe).not.toContain('XP')
    const livre = opcoesDeFinalizar({ tipo: 'livre', topic_id: null, review_id: null }, 25)
    expect(livre.map(x => x.id)).toEqual(['tempo']); expect(livre[0].rotulo).toBe('Registrar o tempo de estudo')
  })
  it('XP previsto', () => {
    expect([xpPrevisto('concluir', { tipo: 'estudo' }, 90), xpPrevisto('concluir', { tipo: 'revisao' }, 90), xpPrevisto('concluir', { tipo: 'flashcards' }, 90), xpPrevisto('tempo', { tipo: 'estudo' }, 90), xpPrevisto('registrar', { tipo: 'questoes' }, 90)]).toEqual([39, 15, 0, 0, 0])
  })
})

describe('destino do registro', () => {
  it('questões: assunto, quantidade planejada e o tempo', () => {
    expect(destinoDoRegistro({ tipo: 'questoes', topic_id: 'T1', review_id: null, qtd_questoes: 20 }, 47)).toBe('/questoes?alvo=t:T1&total=20&tempo=47')
    expect(destinoDoRegistro({ tipo: 'questoes', topic_id: null, review_id: null, qtd_questoes: null }, 12)).toBe('/questoes?tempo=12')
  })
  it('simulado e revisão', () => {
    expect(destinoDoRegistro({ tipo: 'simulado', topic_id: null, review_id: null, qtd_questoes: null }, 150)).toBe('/simulados?tempo=150')
    expect(destinoDoRegistro({ tipo: 'revisao', topic_id: 'T', review_id: 'R9', qtd_questoes: null }, 30)).toBe('/revisoes?rev=R9&tempo=30')
  })
  it('tipos que concluem direto não têm destino', () => {
    expect(destinoDoRegistro({ tipo: 'estudo', topic_id: 'T', review_id: null, qtd_questoes: null }, 30)).toBeNull(); expect(destinoDoRegistro({ tipo: 'livre', topic_id: null, review_id: null, qtd_questoes: null }, 30)).toBeNull()
  })
})
