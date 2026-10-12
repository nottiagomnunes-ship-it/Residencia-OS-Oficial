import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { hojeBR } from './dates'
import { addDays } from './engine/review'
import { fraseDoFim, moverRevisoes, separarAtrasadas, type Atrasada } from './engine/recalcular'

const HOJE = hojeBR(), ONTEM = addDays(HOJE, -1), ANTEONTEM = addDays(HOJE, -2)
const it_ = (o: Partial<Atrasada>): Atrasada => ({ id: 'x', tipo: 'estudo', data: ONTEM, duracao_min: 30, ordem_dia: 1, origem: 'auto', review_id: null, topic_id: null, ...o })

const h = vi.hoisted(() => ({
  atrasadas: [] as any[], futuras: [] as any[], ultimo: [] as any[], rpc: [] as any[], apagados: [] as string[][],
  planos: 0, planoOk: true, extras: [] as any[], blocos: [] as any[], rpcErro: null as any, versaoErro: null as any, desfeito: 'ok', removidaVersao: 0,
}))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({ redirect: () => { throw new Error('REDIRECT') }, useRouter: () => ({ refresh: () => {} }) }))
vi.mock('@/lib/schedule', () => ({ planejarCronograma: async () => { h.planos++; return h.planoOk ? { ok: true, msg: 'Cronograma atualizado: 5 assuntos planejados.' } : { ok: false, msg: 'Defina a data da prova para gerar o cronograma.' } } }))
vi.mock('@/lib/plano-data', () => ({ calcularPlano: async (_sb: unknown, _u: string, extra: any[]) => { h.extras = extra; return { ok: true, r: { blocos: h.blocos, avisos: [], minutosNecessarios: 600, minutosFaltantes: 120 } } } }))
vi.mock('@/lib/supabase/server', () => ({ supabaseServer: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
  rpc: async (n: string, a: any) => {
    h.rpc.push({ n, a })
    if (n === 'salvar_versao_plano') return { data: null, error: h.versaoErro }
    if (n === 'desfazer_recalculo') return { data: h.desfeito, error: null }
    return { data: a.p_mov.length, error: h.rpcErro }
  },
  from: (t: string) => {
    const f: Record<string, unknown> = {}
    const q: any = {
      select: () => q, gte: () => { f.gte = true; return q }, lte: () => q, neq: () => q, order: () => q, limit: () => q,
      lt: (c: string, v: unknown) => { f.lt = v; return q }, eq: (c: string, v: unknown) => { f[c] = v; return q },
      in: (_c: string, ids: string[]) => { f.in = ids; return q }, delete: () => { f.del = true; return q },
      single: async () => ({ data: { daily_minutes: 120, available_weekdays: [0, 1, 2, 3, 4, 5, 6], exam_date: addDays(HOJE, 300) } }),
      then: (r: (v: unknown) => void) => {
        if (f.del) { h.apagados.push(f.in as string[]); return r({ error: null }) }
        if (t === 'schedule_items' && f.lt) return r({ data: h.atrasadas })
        if (t === 'schedule_items' && f.gte && !f.tipo) return r({ data: h.futuras }) // tarefas em aberto dos próximos 21 dias
        if (t === 'schedule_items' && f.tipo === 'estudo') return r({ data: h.ultimo })
        return r({ data: [] })
      },
    }
    return q
  },
}) }))

import { previaRecalcular, recalcularRota } from './recalcular'
import RecalcularRota, { linhasDaPrevia, linhasDaLeve, Viabilidade } from '@/components/RecalcularRota'
import { desfazerRecalculo } from './recalcular'
import { viabilidade, podeDesfazer } from './engine/recalcular'

beforeEach(() => {
  Object.assign(h, { atrasadas: [], futuras: [], ultimo: [], rpc: [], apagados: [], planos: 0, planoOk: true, extras: [], blocos: [], rpcErro: null, versaoErro: null, desfeito: 'ok' })
})

describe('recalcular rota: regras', () => {
  it('separa o que volta para o plano, o que é movido, o que sai e o que fica', () => {
    const s = separarAtrasadas([
      it_({ id: 'e1', topic_id: 't1' }), it_({ id: 'e2', topic_id: 't1', titulo: 'parte 2' } as any), it_({ id: 'e3', topic_id: 't2' }),
      it_({ id: 'r1', tipo: 'revisao', review_id: 'rv1' }), it_({ id: 'q1', tipo: 'questoes' }), it_({ id: 's1', tipo: 'simulado' }),
      it_({ id: 'm1', origem: 'manual' }), it_({ id: 'm2', tipo: 'questoes', origem: 'manual' }),
    ])
    expect(s.assuntos).toBe(2); expect(s.revisoes.map(x => x.id)).toEqual(['r1'])
    expect(s.descartar.map(x => x.id)).toEqual(['q1', 's1']); expect(s.ficam.map(x => x.id)).toEqual(['m1', 'm2'])
  })
  it('revisões atrasadas ocupam no máximo ~30% de cada dia, as mais antigas primeiro', () => {
    const revs = [it_({ id: 'nova', tipo: 'revisao', data: ONTEM, duracao_min: 30 }), it_({ id: 'velha', tipo: 'revisao', data: ANTEONTEM, duracao_min: 30 })]
    const r = moverRevisoes({ hoje: HOJE, revisoes: revs, futuras: [], capacidade: () => 120 }) // 30% de 2 h = 36 min → uma por dia
    expect(r.movimentos.map(m => [m.id, m.para])).toEqual([['velha', HOJE], ['nova', addDays(HOJE, 1)]])
  })
  it('conta as revisões que o dia já tinha e pula dias sem estudo', () => {
    const r = moverRevisoes({ hoje: HOJE, revisoes: [it_({ id: 'a', tipo: 'revisao' })], futuras: [{ id: 'f', tipo: 'revisao', data: HOJE, duracao_min: 30, ordem_dia: 1 }],
      capacidade: d => (d === addDays(HOJE, 1) ? 0 : 120) })
    expect(r.movimentos[0].para).toBe(addDays(HOJE, 2))
  })
  it('não passa da prova nem de 21 dias: o resto fica atrasado', () => {
    expect(moverRevisoes({ hoje: HOJE, limite: addDays(HOJE, -1), revisoes: [it_({ tipo: 'revisao' })], futuras: [], capacidade: () => 120 }).semLugar).toHaveLength(1)
    const muitas = Array.from({ length: 30 }, (_, k) => it_({ id: 'r' + k, tipo: 'revisao' }))
    const r = moverRevisoes({ hoje: HOJE, revisoes: muitas, futuras: [], capacidade: () => 60 }) // 30 min por dia → 21 cabem
    expect(r.movimentos).toHaveLength(21); expect(r.semLugar).toHaveLength(9)
  })
  it('frase do fim do plano', () => {
    expect(fraseDoFim('2027-08-11', '2027-08-20')).toBe('Os assuntos passam a terminar em 20/08/2027, 9 dias depois do que estava (11/08/2027).')
    expect(fraseDoFim('2027-08-11', '2027-08-10')).toContain('1 dia antes')
    expect(fraseDoFim('2027-08-11', '2027-08-11')).toContain('continuam terminando em 11/08/2027')
    expect(fraseDoFim(null, '2027-08-11')).toContain('vão até'); expect(fraseDoFim('2027-08-11', null)).toContain('Nenhum assunto')
  })
})

describe('recalcular rota: prévia e aplicação', () => {
  const cenario = () => {
    h.atrasadas = [it_({ id: 'e1', topic_id: 't1' }), it_({ id: 'r1', tipo: 'revisao', review_id: 'rv1', topic_id: 't9', topics: { nome: 'IC' } } as any),
      it_({ id: 'q1', tipo: 'questoes' }), it_({ id: 'm1', origem: 'manual' })]
    h.ultimo = [{ data: addDays(HOJE, 100) }]
    h.blocos = [{ tipo: 'estudo', data: addDays(HOJE, 103) }, { tipo: 'questoes', data: addDays(HOJE, 200) }]
  }
  it('a prévia não muda nada e conta as revisões movidas no plano calculado', async () => {
    cenario()
    const p = await previaRecalcular()
    expect(h.rpc).toEqual([]); expect(h.apagados).toEqual([]); expect(h.planos).toBe(0)
    expect(p).toMatchObject({ ok: true, equilibrada: { assuntos: 1, revisoes: 1, revisoesSemLugar: 0, descartar: 1, ficam: 1, ateRevisoes: HOJE }, leve: { total: 4, movidas: 4, semLugar: 0 } })
    expect(h.extras).toEqual([{ data: HOJE, duracao_min: 30, topic_id: 't9', nome: 'IC' }])
    if (p.ok) {
      expect(p.viab).toEqual({ necessarioH: 10, cabeH: 8, faltaH: 2, pct: 80 })
      expect(p.equilibrada.fim).toContain('3 dias depois')
      const l = linhasDaPrevia(p.equilibrada).join(' ')
      expect(l).toContain('1 assunto atrasado volta'); expect(l).toContain('1 revisão atrasada vai'); expect(l).toContain('1 bloco de questões de dias passados sai'); expect(l).toContain('1 tarefa que você criou fica')
    }
  })
  it('aplicar: move as revisões, refaz o plano e só então apaga os blocos de questões passados', async () => {
    cenario()
    const r = await recalcularRota()
    expect(h.rpc).toEqual([{ n: 'salvar_versao_plano', a: { p_modo: 'equilibrada' } }, { n: 'aplicar_movimentos', a: { p_mov: [{ id: 'r1', data: HOJE, ordem_dia: 0 }] } }])
    expect(h.planos).toBe(1); expect(h.apagados).toEqual([['q1']])
    expect(r).toEqual({ ok: true, desfazer: true, msg: 'Rota recalculada. Plano refeito a partir de hoje: 5 assuntos planejados.' })
  })
  it('se mover as revisões falhar, não refaz nem apaga nada', async () => {
    cenario(); h.rpcErro = { message: 'x' }
    const r = await recalcularRota()
    expect(r.ok).toBe(false); expect(h.planos).toBe(0); expect(h.apagados).toEqual([])
  })
  it('se o plano não puder ser refeito, avisa e não apaga os blocos', async () => {
    cenario(); h.planoOk = false
    const r = await recalcularRota()
    expect(r.ok).toBe(false); expect(r.msg).toContain('Defina a data da prova'); expect(h.apagados).toEqual([])
  })
  it('o botão aparece com a contagem das atrasadas', () => {
    const html = renderToStaticMarkup(<RecalcularRota n={3} />)
    expect(html).toContain('Recalcular rota'); expect(html).toContain('3 tarefas atrasadas')
  })
  it('sem a migração 0051 recalcula do mesmo jeito, só sem desfazer; outro erro ao guardar a cópia não muda nada', async () => {
    cenario(); h.versaoErro = { code: 'PGRST202', message: 'Could not find the function' }
    expect(await recalcularRota()).toMatchObject({ ok: true, desfazer: false }); expect(h.planos).toBe(1)
    Object.assign(h, { rpc: [], planos: 0, apagados: [], versaoErro: { code: '500', message: 'x' } })
    expect((await recalcularRota()).ok).toBe(false); expect(h.rpc.map(x => x.n)).toEqual(['salvar_versao_plano']); expect(h.planos).toBe(0)
  })
  it('rota leve: guarda a cópia e só encaixa as atrasadas no tempo que sobra, sem refazer o plano', async () => {
    cenario()
    const r = await recalcularRota('leve')
    expect(h.rpc.map(x => x.n)).toEqual(['salvar_versao_plano', 'aplicar_movimentos']); expect(h.rpc[1].a.p_mov).toHaveLength(4)
    expect(h.planos).toBe(0); expect(h.apagados).toEqual([]); expect(r).toMatchObject({ ok: true, desfazer: true }); expect(r.msg).toContain('4 tarefas encaixadas')
  })
  it('rota leve sem nada que caiba: não guarda cópia nem muda nada', async () => {
    cenario(); h.futuras = Array.from({ length: 21 }, (_, k) => ({ id: 'f' + k, tipo: 'estudo', data: addDays(HOJE, k), duracao_min: 999, ordem_dia: 1 })) // todos os dias cheios
    const r = await recalcularRota('leve')
    expect(h.rpc).toEqual([]); expect(r.msg).toContain('Nada das atrasadas cabe')
  })
  it('desfazer: mensagens de cada resultado', async () => {
    expect(await desfazerRecalculo()).toEqual({ ok: true, msg: 'Recálculo desfeito: o plano voltou a ser o de antes.' })
    h.desfeito = 'concluiu'; expect((await desfazerRecalculo()).msg).toContain('já concluiu tarefas do plano novo')
    h.desfeito = 'expirou'; expect((await desfazerRecalculo()).msg).toContain('mais de 7 dias')
  })
})

describe('recalcular rota: viabilidade e telas', () => {
  it('viabilidade', () => {
    expect(viabilidade(600, 0)).toMatchObject({ pct: 100, faltaH: 0 }); expect(viabilidade(0, 0).pct).toBe(100)
    expect(viabilidade(4800, 1200)).toEqual({ necessarioH: 80, cabeH: 60, faltaH: 20, pct: 75 })
    expect(renderToStaticMarkup(<Viabilidade v={viabilidade(4800, 1200)} />)).toContain('Cabem 60 h das 80 h de assuntos que faltam (75%)')
    expect(renderToStaticMarkup(<Viabilidade v={viabilidade(600, 0)} />)).toContain('Cabe tudo')
  })
  it('desfazer só até 7 dias', () => {
    const agora = new Date('2026-10-12T12:00:00Z')
    expect(podeDesfazer('2026-10-06T12:00:01Z', agora)).toBe(true); expect(podeDesfazer('2026-10-05T11:00:00Z', agora)).toBe(false); expect(podeDesfazer(null, agora)).toBe(false)
  })
  it('prévia da rota leve', () => {
    expect(linhasDaLeve({ total: 0, movidas: 0, semLugar: 0, ate: null })[0]).toContain('Não há tarefas atrasadas')
    expect(linhasDaLeve({ total: 3, movidas: 0, semLugar: 3, ate: null })[0]).toContain('A rota equilibrada')
    expect(linhasDaLeve({ total: 3, movidas: 2, semLugar: 1, ate: '2026-10-20' }).join(' ')).toBe('2 tarefas atrasadas são encaixadas no tempo que sobra até 20/10, sem mexer no resto do plano. 1 não cabe e continua atrasada.')
  })
})
