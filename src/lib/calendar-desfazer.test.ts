import { describe, it, expect, vi, beforeEach } from 'vitest'

// banco simulado: cada tabela devolve, em ordem, os resultados combinados (o último se repete); toda gravação fica registrada
const h = vi.hoisted(() => ({ ops: [] as { t: string; op: string; arg: any }[], fila: {} as Record<string, any[]>, erroUpdate: {} as Record<string, any>, revalidadas: [] as string[] }))
const proximo = (t: string) => { const f = h.fila[t]; if (!f || !f.length) return { data: null, error: null }; return f.length > 1 ? f.shift() : f[0] }
const cadeia = (t: string) => {
  let op = 'select'
  const c: any = new Proxy({}, { get: (_, k: string) => {
    if (k === 'then') return (ok: any) => ok(op === 'select' ? proximo(t) : { data: null, error: h.erroUpdate[t] ?? null })
    if (k === 'update' || k === 'delete' || k === 'insert') return (arg: any) => { op = k; h.ops.push({ t, op: k, arg }); return c }
    if (k === 'single' || k === 'maybeSingle') return () => Promise.resolve(proximo(t))
    return () => c
  } })
  return c
}
vi.mock('@/lib/supabase/server', () => ({ supabaseServer: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) }, from: (t: string) => cadeia(t) }) }))
vi.mock('@/lib/dates', () => ({ hojeBR: () => '2026-10-05' }))   // segunda-feira
vi.mock('@/lib/flow', () => ({ concluirConteudo: vi.fn(), concluirRevisao: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: (p: string) => { h.revalidadas.push(p) } }))
vi.mock('next/navigation', () => ({ redirect: (u: string) => { throw new Error('REDIRECT ' + u) } }))
import { adiarItem, moverItem, desfazerMovimento } from './calendar'
import { validarDesfazer } from './engine/movimento'

const rev = () => h.revalidadas
const I = '00000000-0000-0000-0000-0000000000a1', R = '00000000-0000-0000-0000-0000000000b2', T = '00000000-0000-0000-0000-0000000000c3'
const item = (o: any = {}) => ({ id: I, titulo: 'Imunizações', tipo: 'estudo', status: 'atrasado', data: '2026-10-02', review_id: null, topic_id: null, duracao_min: 60, hora_ini: null, hora_fim: null, ...o })
const gravacoes = (t?: string) => h.ops.filter(o => ['update', 'delete', 'insert'].includes(o.op) && (!t || o.t === t))
beforeEach(() => { h.ops.length = 0; h.fila = {}; h.erroUpdate = {}; rev().length = 0 })

describe('adiar: devolve o estado de ANTES para poder desfazer', () => {
  it('estudo de um assunto: guarda a data planejada e se o plano o movia sozinho', async () => {
    h.fila.schedule_items = [{ data: item({ topic_id: T }) }]; h.fila.topics = [{ data: { planned_date: '2026-10-02', planned_auto: true } }]
    const r = await adiarItem(I)
    expect(r.conflito).toBeUndefined(); expect(r.desfazer).toEqual({ id: I, titulo: 'Imunizações', de: '2026-10-02', para: '2026-10-06', rotulo: 'amanhã', status: 'atrasado', review: null, topic: { id: T, planned: '2026-10-02', auto: true } })
    expect(gravacoes('schedule_items')[0].arg).toEqual({ data: '2026-10-06', status: 'agendado' }); expect(gravacoes('topics')[0].arg).toEqual({ planned_date: '2026-10-06', planned_auto: false })
  })
  it('revisão: guarda o prazo anterior da revisão', async () => {
    h.fila.schedule_items = [{ data: item({ tipo: 'revisao', review_id: R, topic_id: T, titulo: 'Revisão D1 — DM', status: 'agendado', data: '2026-10-05' }) }]; h.fila.reviews = [{ data: { due_date: '2026-10-05' } }]
    const r = await adiarItem(I)
    expect(r.desfazer).toMatchObject({ de: '2026-10-05', para: '2026-10-06', rotulo: 'amanhã', status: 'agendado', review: { id: R, due: '2026-10-05' }, topic: null }); expect(gravacoes('reviews')[0].arg).toEqual({ due_date: '2026-10-06' }); expect(gravacoes('topics')).toHaveLength(0)
  })
  it('tarefa sem assunto nem revisão (manual, questões): só a própria tarefa', async () => {
    h.fila.schedule_items = [{ data: item({ tipo: 'questoes', titulo: '30 questões' }) }]; const r = await adiarItem(I)
    expect(r.desfazer).toMatchObject({ review: null, topic: null }); expect(gravacoes('reviews')).toHaveLength(0); expect(gravacoes('topics')).toHaveLength(0)
  })
  it('adiar uma tarefa FUTURA soma um dia à data dela (não a hoje)', async () => {
    h.fila.schedule_items = [{ data: item({ data: '2026-10-09', status: 'agendado' }) }]; const r = await adiarItem(I); expect(r.desfazer).toMatchObject({ de: '2026-10-09', para: '2026-10-10', rotulo: 'sábado, 10/10' })
  })
  it('o que é devolvido passa na própria validação do desfazer (o ciclo fecha)', async () => {
    h.fila.schedule_items = [{ data: item({ topic_id: T }) }]; h.fila.topics = [{ data: { planned_date: null, planned_auto: false } }]
    const r = await adiarItem(I); expect(validarDesfazer(r.desfazer)).toEqual(r.desfazer)
  })
  it('tarefa concluída ou inexistente: nada acontece e nada é devolvido', async () => {
    h.fila.schedule_items = [{ data: item({ status: 'concluido' }) }]; expect(await adiarItem(I)).toEqual({}); expect(gravacoes()).toHaveLength(0)
    h.fila.schedule_items = [{ data: null }]; expect(await adiarItem(I)).toEqual({}); expect(gravacoes()).toHaveLength(0)
  })
  it('conflito de horário: avisa e não grava; forçando, grava e devolve o desfazer', async () => {
    h.fila.schedule_items = [{ data: item({ hora_ini: '10:00:00', hora_fim: '11:00:00', status: 'agendado', data: '2026-10-05' }) }, { data: [{ id: 'outra', titulo: 'Plantão', hora_ini: '10:30:00', hora_fim: '12:00:00', duracao_min: 90 }] }]
    h.fila.commitments = [{ data: [] }]
    const r = await adiarItem(I, false); expect(r.conflito).toContain('Plantão'); expect(r.desfazer).toBeUndefined(); expect(gravacoes()).toHaveLength(0)
    h.fila.schedule_items = [{ data: item({ hora_ini: '10:00:00', hora_fim: '11:00:00', status: 'agendado', data: '2026-10-05' }) }]
    const f = await adiarItem(I, true); expect(f.desfazer).toMatchObject({ para: '2026-10-06' }); expect(gravacoes('schedule_items')).toHaveLength(1)
  })
})

describe('mover (arrastar ou escolher data): também pode ser desfeito', () => {
  it('leva a data escolhida e guarda a de antes', async () => {
    h.fila.schedule_items = [{ data: item({ status: 'agendado', data: '2026-10-07' }) }]; const r = await moverItem(I, '2026-10-08')
    expect(r.desfazer).toMatchObject({ de: '2026-10-07', para: '2026-10-08', rotulo: 'quinta, 08/10' }); expect(gravacoes('schedule_items')[0].arg).toEqual({ data: '2026-10-08', status: 'agendado' })
  })
  it('data inválida ou tarefa concluída: nada', async () => {
    h.fila.schedule_items = [{ data: item() }]; expect(await moverItem(I, 'amanhã')).toEqual({}); h.fila.schedule_items = [{ data: item({ status: 'concluido' }) }]; expect(await moverItem(I, '2026-10-08')).toEqual({}); expect(gravacoes()).toHaveLength(0)
  })
})

describe('desfazerMovimento', () => {
  const snap = (o: any = {}) => ({ id: I, titulo: 'Imunizações', de: '2026-10-02', para: '2026-10-06', rotulo: 'amanhã', status: 'atrasado', review: null, topic: null, ...o })
  const atual = (o: any = {}) => { h.fila.schedule_items = [{ data: { id: I, status: 'agendado', data: '2026-10-06', ...o } }] }
  it('estudo de assunto: devolve a tarefa, a data planejada e o "plano move sozinho", e atualiza as telas', async () => {
    atual(); const r = await desfazerMovimento(snap({ topic: { id: T, planned: '2026-10-02', auto: true } }))
    expect(r).toEqual({ ok: true }); expect(gravacoes('schedule_items')[0].arg).toEqual({ data: '2026-10-02', status: 'atrasado' }); expect(gravacoes('topics')[0].arg).toEqual({ planned_date: '2026-10-02', planned_auto: true }); expect(rev()).toContain('/calendario'); expect(rev()).toContain('/inicio')
  })
  it('revisão: devolve o prazo anterior', async () => { atual(); await desfazerMovimento(snap({ review: { id: R, due: '2026-10-05' } })); expect(gravacoes('reviews')[0].arg).toEqual({ due_date: '2026-10-05' }); expect(gravacoes('topics')).toHaveLength(0) })
  it('só a tarefa: não mexe em revisão nem assunto', async () => { atual(); expect((await desfazerMovimento(snap())).ok).toBe(true); expect(gravacoes('reviews')).toHaveLength(0); expect(gravacoes('topics')).toHaveLength(0) })
  it('se a tarefa já foi movida de novo para outro dia: recusa e não mexe em nada', async () => {
    atual({ data: '2026-10-09' }); const r = await desfazerMovimento(snap()); expect(r.ok).toBe(false); expect(r.erro).toContain('mudou de data'); expect(gravacoes()).toHaveLength(0)
  })
  it('se a tarefa já foi concluída: recusa (e a conclusão nunca é desfeita por aqui)', async () => { atual({ status: 'concluido' }); const r = await desfazerMovimento(snap()); expect(r.ok).toBe(false); expect(r.erro).toContain('concluída'); expect(gravacoes()).toHaveLength(0) })
  it('se a tarefa não existe mais (ex.: o cronograma foi refeito): recusa', async () => { h.fila.schedule_items = [{ data: null }]; const r = await desfazerMovimento(snap()); expect(r.ok).toBe(false); expect(r.erro).toContain('não existe mais'); expect(gravacoes()).toHaveLength(0) })
  it('dados adulterados ou lixo: recusa antes de consultar o banco', async () => {
    for (const x of [null, 'x', {}, snap({ id: 'qualquer' }), snap({ status: 'concluido' }), snap({ para: 'amanhã' }), snap({ review: { id: R, due: '2026-10-05' }, topic: { id: T, planned: null, auto: true } })]) { const r = await desfazerMovimento(x); expect(r.ok).toBe(false) }
    expect(gravacoes()).toHaveLength(0); expect(h.ops).toHaveLength(0)
  })
  it('se gravar a tarefa falhar: avisa e NÃO mexe na revisão nem no assunto (nada fica pela metade)', async () => {
    atual(); h.erroUpdate.schedule_items = { code: 'x' }; const r = await desfazerMovimento(snap({ review: { id: R, due: '2026-10-05' } }))
    expect(r.ok).toBe(false); expect(gravacoes('reviews')).toHaveLength(0); expect(rev()).toHaveLength(0)
  })
  it('ciclo completo: adiar e desfazer deixam a tarefa como estava', async () => {
    h.fila.schedule_items = [{ data: item({ topic_id: T }) }]; h.fila.topics = [{ data: { planned_date: '2026-10-02', planned_auto: true } }]
    const adiada = await adiarItem(I); h.ops.length = 0
    atual({ data: adiada.desfazer!.para }); await desfazerMovimento(adiada.desfazer)
    expect(gravacoes('schedule_items')[0].arg).toEqual({ data: '2026-10-02', status: 'atrasado' }); expect(gravacoes('topics')[0].arg).toEqual({ planned_date: '2026-10-02', planned_auto: true })
  })
})
