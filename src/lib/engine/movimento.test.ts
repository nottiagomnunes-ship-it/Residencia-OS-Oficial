import { describe, it, expect } from 'vitest'
import { validarDesfazer } from './movimento'

const U = '00000000-0000-0000-0000-0000000000a1', R = '00000000-0000-0000-0000-0000000000b2', T = '00000000-0000-0000-0000-0000000000c3'
const base = (o: any = {}) => ({ id: U, titulo: 'Imunizações', de: '2026-10-05', para: '2026-10-06', rotulo: 'amanhã', status: 'atrasado', review: null, topic: null, ...o })

describe('validarDesfazer', () => {
  it('aceita um adiamento simples, de revisão ou de estudo com assunto, devolvendo o objeto limpo', () => {
    expect(validarDesfazer(base())).toEqual(base())
    expect(validarDesfazer(base({ review: { id: R, due: '2026-10-05' } }))!.review).toEqual({ id: R, due: '2026-10-05' })
    expect(validarDesfazer(base({ topic: { id: T, planned: '2026-10-05', auto: true } }))!.topic).toEqual({ id: T, planned: '2026-10-05', auto: true })
    expect(validarDesfazer(base({ topic: { id: T, planned: null, auto: false } }))!.topic).toEqual({ id: T, planned: null, auto: false })
  })
  it('campos extras são descartados (não passam adiante)', () => { expect(validarDesfazer({ ...base(), user_id: 'x', extra: 1 })).toEqual(base()) })
  it('recusa o que não é objeto', () => { for (const x of [null, undefined, 'x', 1, [], true]) expect(validarDesfazer(x)).toBeNull() })
  it('recusa ids que não são identificadores, datas inválidas e textos fora do limite', () => {
    for (const o of [{ id: 'nao-e-uuid' }, { id: undefined }, { de: '05/10/2026' }, { para: '2026-13-45' }, { para: undefined }, { titulo: 'x'.repeat(301) }, { titulo: 5 }, { rotulo: 'x'.repeat(41) }]) expect(validarDesfazer(base(o)), JSON.stringify(o)).toBeNull()
  })
  it('só restaura status que fazem sentido; "concluido" nunca volta por aqui', () => {
    for (const s of ['agendado', 'proximo', 'atrasado', 'adiado']) expect(validarDesfazer(base({ status: s }))).not.toBeNull()
    for (const s of ['concluido', 'qualquer', '', null]) expect(validarDesfazer(base({ status: s }))).toBeNull()
  })
  it('revisão e assunto malformados são recusados, e não podem vir juntos', () => {
    expect(validarDesfazer(base({ review: { id: 'x', due: '2026-10-05' } }))).toBeNull(); expect(validarDesfazer(base({ review: { id: R, due: 'ontem' } }))).toBeNull()
    expect(validarDesfazer(base({ topic: { id: T, planned: '2026-10-05', auto: 'sim' } }))).toBeNull(); expect(validarDesfazer(base({ topic: { id: T, planned: 'amanhã', auto: true } }))).toBeNull()
    expect(validarDesfazer(base({ review: { id: R, due: '2026-10-05' }, topic: { id: T, planned: null, auto: true } }))).toBeNull()
  })
})
