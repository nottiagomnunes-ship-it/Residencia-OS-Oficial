import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

// Supabase de mentira com respostas em fila (uma por consulta) e registro do que foi gravado.
const h = vi.hoisted(() => ({ fila: [] as { data?: any; error?: any }[], ops: [] as { op: string; v?: any; filtros: string[] }[] }))
const cadeia = () => {
  const o = { op: 'select', v: undefined as any, filtros: [] as string[] }
  const r: any = {}
  for (const m of ['select', 'eq', 'order']) r[m] = (...a: any[]) => { if (m === 'eq') o.filtros.push(a.join('=')); return r }
  const fim = async () => { h.ops.push(o); return o.op === 'select' ? (h.fila.shift() ?? { data: null }) : { error: null } }
  r.maybeSingle = fim
  r.then = (ok: any) => fim().then(ok)
  r.update = (v: any) => { o.op = 'update'; o.v = v; return r }
  r.delete = () => { o.op = 'delete'; return r }
  r.insert = (v: any) => { o.op = 'insert'; o.v = v; return fim() }
  return r
}
vi.mock('@/lib/supabase/server', () => ({ supabaseServer: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) }, from: () => cadeia() }) }))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({ redirect: () => { throw new Error('REDIRECT') }, useRouter: () => ({ refresh: () => {} }) }))
vi.mock('@/lib/dates', () => ({ hojeBR: () => '2026-10-07' }))

import { liberarHorario, excluirHorarioDaAgenda, desfazerNaAgenda } from './agenda'
import BlocoAgenda from '@/components/BlocoAgenda'
import { ocupadosPorData, paraCompromisso } from './engine/compromissos'

const semanal = { id: 'c1', titulo: 'Internato', categoria: 'internato', tipo: 'semanal', dias: [1, 2, 3, 4, 5], data: null, hora_ini: '07:00:00', hora_fim: '13:00:00', valido_de: null, valido_ate: null }
const gravados = (op: string) => h.ops.filter(o => o.op === op)
beforeEach(() => { h.fila = []; h.ops = [] })

describe('liberar um horário direto pelo Calendário', () => {
  it('"toda semana": só aquela data fica livre (sem repetir data e em ordem)', async () => {
    h.fila = [{ data: semanal }, { data: { excecoes: ['2026-10-14'] } }]
    expect(await liberarHorario('c1', '2026-10-07')).toEqual({ ok: true, desfazer: { tipo: 'excecao', id: 'c1', data: '2026-10-07' } })
    expect(gravados('update')[0].v).toEqual({ excecoes: ['2026-10-07', '2026-10-14'] })
    expect(gravados('delete')).toEqual([])
  })
  it('"só um dia": o compromisso sai, e o desfazer traz ele de volta igual', async () => {
    const pontual = { ...semanal, id: 'c2', tipo: 'pontual', dias: [], data: '2026-10-07', titulo: 'Plantão', categoria: 'plantao', hora_ini: '19:00:00', hora_fim: '07:00:00' }
    h.fila = [{ data: pontual }]
    const r = await liberarHorario('c2', '2026-10-07')
    expect(r.ok).toBe(true); expect(gravados('delete')[0].filtros).toEqual(['id=c2'])
    h.ops = []
    expect(await desfazerNaAgenda(r.desfazer!)).toEqual({ ok: true })
    expect(gravados('insert')[0].v).toMatchObject({ titulo: 'Plantão', categoria: 'plantao', tipo: 'pontual', data: '2026-10-07', hora_ini: '19:00', hora_fim: '07:00', user_id: 'u1', agenda: true })
  })
  it('desfazer a liberação: a data sai das exceções', async () => {
    h.fila = [{ data: { excecoes: ['2026-10-07', '2026-10-14'] } }]
    expect(await desfazerNaAgenda({ tipo: 'excecao', id: 'c1', data: '2026-10-07' })).toEqual({ ok: true })
    expect(gravados('update')[0].v).toEqual({ excecoes: ['2026-10-14'] })
  })
  it('sem a 0033: avisa e não mexe em nada; horário que não existe mais também avisa', async () => {
    h.fila = [{ data: semanal }, { error: { message: 'column commitments.excecoes does not exist' } }]
    expect((await liberarHorario('c1', '2026-10-07')).erro).toContain('0033_liberar_horario.sql'); expect(gravados('update')).toEqual([])
    h.fila = [{ data: null }]
    expect(await liberarHorario('x', '2026-10-07')).toEqual({ ok: false, erro: 'Esse horário não está mais na agenda.' })
    expect(await liberarHorario('c1', 'ontem')).toEqual({ ok: false })
  })
  it('excluir de todas as semanas guarda as datas liberadas para o desfazer', async () => {
    h.fila = [{ data: { ...semanal, excecoes: ['2026-10-07'] } }]
    const r = await excluirHorarioDaAgenda('c1')
    expect(r.ok).toBe(true); expect(gravados('delete')).toHaveLength(1)
    h.ops = []; await desfazerNaAgenda(r.desfazer!)
    expect(gravados('insert')[0].v).toMatchObject({ tipo: 'semanal', dias: [1, 2, 3, 4, 5], excecoes: ['2026-10-07'] })
  })
})

describe('o dia liberado some do calendário', () => {
  it('a ocorrência daquele dia (e a continuação da madrugada) não aparece; as outras semanas seguem', () => {
    const c = paraCompromisso({ ...semanal, id: 'p', titulo: 'Plantão', dias: [3], hora_ini: '19:00:00', hora_fim: '07:00:00', excecoes: ['2026-10-07'] })
    const o = ocupadosPorData([c], '2026-10-07', '2026-10-15')
    expect(o['2026-10-07']).toBeUndefined(); expect(o['2026-10-08']).toBeUndefined()
    expect(o['2026-10-14'][0]).toMatchObject({ id: 'p', inicio: '2026-10-14', recorrente: true }); expect(o['2026-10-15'][0]).toMatchObject({ inicio: '2026-10-14' })
  })
  it('na tela: bloco da agenda é um botão que abre as opções; sem id (modelo antigo), só mostra', () => {
    const com = renderToStaticMarkup(<BlocoAgenda o={{ ini: 420, fim: 780, titulo: 'Internato', id: 'c1', inicio: '2026-10-07', recorrente: true, categoria: 'internato' }} className="x">07:00 Internato</BlocoAgenda>)
    expect(com).toContain('<button'); expect(com).toContain('aria-label="Internato, 07:00 às 13:00. Abrir opções"'); expect(com).toContain('aria-haspopup="dialog"')
    expect(renderToStaticMarkup(<BlocoAgenda o={{ ini: 420, fim: 780, titulo: 'X' }} className="x">X</BlocoAgenda>)).not.toContain('<button')
  })
})
