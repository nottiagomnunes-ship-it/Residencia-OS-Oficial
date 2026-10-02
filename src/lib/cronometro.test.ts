import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- banco simulado: cada tabela devolve o combinado; toda chamada fica registrada ----
const campos = (f: FormData) => { const o: Record<string, string> = {}; for (const k of ['topic_id', 'duration_min', 'review_id', 'tempo_min']) { const v = f.get(k); if (v !== null) o[k] = String(v) } return o }
const h = vi.hoisted(() => ({
  chamadas: [] as string[], rpcs: [] as { nome: string; args: any }[], flows: [] as { fn: string; campos: Record<string, string> }[],
  tabelas: {} as Record<string, any>, rpcRes: {} as Record<string, any>, flowErro: null as null | string,
}))
const cadeia = (tabela: string) => {
  let op = 'select'
  const c: any = new Proxy({}, { get: (_, k: string) => {
    if (k === 'then') return (ok: any) => ok(res(tabela, op))
    if (['delete', 'update', 'insert'].includes(k)) return (...a: any[]) => { op = k; h.chamadas.push(`${tabela}.${k}${a[0] && typeof a[0] === 'object' ? ':' + JSON.stringify(a[0]) : ''}`); return c }
    if (k === 'maybeSingle' || k === 'single') return () => { h.chamadas.push(`${tabela}.${k}`); return Promise.resolve(res(tabela, 'select')) }
    return () => c
  } })
  return c
}
const res = (t: string, op: string) => { const v = h.tabelas[t]; return op === 'select' && v !== undefined ? (typeof v === 'function' ? v() : v) : { data: null, error: null } }
vi.mock('@/lib/supabase/server', () => ({ supabaseServer: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) }, from: (t: string) => cadeia(t),
  rpc: async (nome: string, args: any) => { h.rpcs.push({ nome, args }); return h.rpcRes[nome] ?? { data: null, error: null } },
}) }))
vi.mock('@/lib/flow', () => ({
  concluirConteudo: async (f: FormData) => { if (h.flowErro) throw new Error(h.flowErro); h.flows.push({ fn: 'concluirConteudo', campos: campos(f) }) },
  concluirRevisao: async (f: FormData) => { if (h.flowErro) throw new Error(h.flowErro); h.flows.push({ fn: 'concluirRevisao', campos: campos(f) }) },
}))
vi.mock('@/lib/dates', () => ({ hojeBR: () => '2026-10-05' }))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({ redirect: (u: string) => { throw new Error('REDIRECT ' + u) } }))
import { iniciarCronometro, pausarCronometro, finalizarCronometro, descartarCronometro } from './cronometro'

const crono = (o: any = {}) => ({ id: 'c1', item_id: 'i1', tipo: 'estudo', titulo: 'Imunizações', topic_id: 't1', review_id: null, planejado_min: 60, qtd_questoes: null, iniciado_em: '2026-10-05T10:00:00Z', acumulado_seg: 0, pausado: false, ...o })
beforeEach(() => { h.chamadas.length = 0; h.rpcs.length = 0; h.flows.length = 0; h.tabelas = {}; h.rpcRes = {}; h.flowErro = null })

describe('iniciarCronometro', () => {
  it('a partir de uma tarefa: leva o tipo, o assunto, a revisão e a duração planejada', async () => {
    h.tabelas.schedule_items = { data: { id: 'i9', tipo: 'revisao', titulo: 'Revisão D1 — DM', topic_id: 't1', review_id: 'r1', duracao_min: 30, qtd_questoes: null, status: 'agendado' } }
    h.rpcRes.iniciar_cronometro = { data: [crono({ id: 'novo' })] }
    const r = await iniciarCronometro('i9')
    expect(r.cron?.id).toBe('novo')
    expect(h.rpcs[0]).toEqual({ nome: 'iniciar_cronometro', args: { p_item: 'i9', p_tipo: 'revisao', p_titulo: 'Revisão D1 — DM', p_topic: 't1', p_review: 'r1', p_planejado: 30, p_qtd: null } })
  })
  it('livre: sem tarefa, com o título combinado', async () => {
    h.rpcRes.iniciar_cronometro = { data: [crono({ tipo: 'livre' })] }
    await iniciarCronometro(null, 'Estudo livre')
    expect(h.rpcs[0].args).toMatchObject({ p_item: null, p_tipo: 'livre', p_titulo: 'Estudo livre' })
  })
  it('tarefa já concluída ou inexistente não inicia nada', async () => {
    h.tabelas.schedule_items = { data: { id: 'i9', tipo: 'estudo', titulo: 'X', status: 'concluido' } }
    expect(await iniciarCronometro('i9')).toEqual({ erro: 'falha' }); expect(h.rpcs).toHaveLength(0)
    h.tabelas.schedule_items = { data: null }
    expect(await iniciarCronometro('nao-existe')).toEqual({ erro: 'falha' })
  })
  it('já há um cronômetro: não cria outro e diz qual está rodando', async () => {
    h.rpcRes.iniciar_cronometro = { data: [] }; h.tabelas.cronometros = { data: { titulo: 'Cirrose' } }
    expect(await iniciarCronometro(null)).toEqual({ erro: 'ativo', ativo: 'Cirrose' })
  })
  it('erro do banco (ex.: migração ainda não aplicada) vira "falha", sem estourar', async () => {
    h.rpcRes.iniciar_cronometro = { data: null, error: { code: '42883' } }
    expect(await iniciarCronometro(null)).toEqual({ erro: 'falha' })
  })
})

describe('pausar', () => {
  it('devolve o estado atual do servidor', async () => { h.rpcRes.pausar_cronometro = { data: [crono({ pausado: true, acumulado_seg: 600 })] }; expect((await pausarCronometro()).cron?.acumulado_seg).toBe(600) })
  it('sem cronômetro, avisa erro', async () => { h.rpcRes.pausar_cronometro = { data: [] }; expect(await pausarCronometro()).toEqual({ erro: true }) })
})

describe('finalizarCronometro — conclui pelo MESMO caminho de sempre, com o tempo medido', () => {
  it('estudo com assunto: concluir assunto com os minutos reais, e o cronômetro é apagado depois', async () => {
    h.tabelas.cronometros = { data: crono() }; h.tabelas.topics = { data: { status: 'planejado' } }
    expect(await finalizarCronometro('concluir', 47)).toEqual({ ok: true, aviso: undefined })
    expect(h.flows).toEqual([{ fn: 'concluirConteudo', campos: { topic_id: 't1', duration_min: '47' } }])
    expect(h.chamadas).toContain('cronometros.delete'); expect(h.chamadas.indexOf('cronometros.delete')).toBeGreaterThan(h.chamadas.indexOf('topics.maybeSingle'))
  })
  it('estudo, assunto JÁ concluído: registra só o tempo (nada se perde) e avisa', async () => {
    h.tabelas.cronometros = { data: crono() }; h.tabelas.topics = { data: { status: 'concluido' } }
    const r = await finalizarCronometro('concluir', 30)
    expect(r.ok).toBe(true); expect(r.aviso).toContain('já estava concluído'); expect(h.flows).toHaveLength(0)
    expect(h.rpcs).toEqual([{ nome: 'registrar_dia', args: { p_dia: '2026-10-05', p_xp: 0, p_min: 30, p_q: 0, p_ac: 0 } }])
  })
  it('estudo sem assunto (reforço): XP e minutos reais e a tarefa fica concluída', async () => {
    h.tabelas.cronometros = { data: crono({ topic_id: null }) }
    await finalizarCronometro('concluir', 50)
    expect(h.rpcs[0]).toEqual({ nome: 'registrar_dia', args: { p_dia: '2026-10-05', p_xp: 35, p_min: 50, p_q: 0, p_ac: 0 } })   // 30 + 50/10
    expect(h.chamadas.some(c => c.startsWith('schedule_items.update') && c.includes('concluido'))).toBe(true)
  })
  it('revisão: concluir com o tempo medido', async () => {
    h.tabelas.cronometros = { data: crono({ tipo: 'revisao', review_id: 'r1', topic_id: 't1' }) }; h.tabelas.reviews = { data: { status: 'pendente' } }
    await finalizarCronometro('concluir', 31)
    expect(h.flows).toEqual([{ fn: 'concluirRevisao', campos: { review_id: 'r1', tempo_min: '31' } }])
  })
  it('revisão já concluída (ou apagada): só o tempo', async () => {
    h.tabelas.cronometros = { data: crono({ tipo: 'revisao', review_id: 'r1' }) }; h.tabelas.reviews = { data: { status: 'concluida' } }
    expect((await finalizarCronometro('concluir', 20)).aviso).toContain('já estava concluída'); expect(h.flows).toHaveLength(0)
  })
  it('"só o tempo" nunca conclui nada, em qualquer tipo', async () => {
    for (const tipo of ['estudo', 'revisao', 'flashcards']) {
      h.flows.length = 0; h.rpcs.length = 0; h.tabelas.cronometros = { data: crono({ tipo, review_id: 'r1' }) }
      await finalizarCronometro('tempo', 25)
      expect(h.flows).toHaveLength(0); expect(h.rpcs).toEqual([{ nome: 'registrar_dia', args: { p_dia: '2026-10-05', p_xp: 0, p_min: 25, p_q: 0, p_ac: 0 } }])
    }
  })
  it('questões e simulado NÃO se concluem direto (o resultado só existe no registro)', async () => {
    for (const tipo of ['questoes', 'simulado']) {
      h.tabelas.cronometros = { data: crono({ tipo }) }
      const r = await finalizarCronometro('concluir', 40); expect(r.ok).toBe(false); expect(r.erro).toContain('registro')
    }
    expect(h.chamadas.filter(c => c === 'cronometros.delete')).toHaveLength(0)
  })
  it('estudo livre: registra o tempo, sem XP', async () => {
    h.tabelas.cronometros = { data: crono({ tipo: 'livre', item_id: null, topic_id: null }) }
    await finalizarCronometro('tempo', 40); expect(h.rpcs[0].args).toMatchObject({ p_xp: 0, p_min: 40 })
  })
  it('flashcards: concluir registra o tempo (sem XP) e fecha a tarefa', async () => {
    h.tabelas.cronometros = { data: crono({ tipo: 'flashcards', topic_id: null }) }
    await finalizarCronometro('concluir', 15)
    expect(h.rpcs[0].args).toMatchObject({ p_xp: 0, p_min: 15 }); expect(h.chamadas.some(c => c.startsWith('schedule_items.update'))).toBe(true)
  })
})

describe('finalizarCronometro — proteções', () => {
  it('minutos inválidos são recusados e nada muda', async () => {
    h.tabelas.cronometros = { data: crono() }
    for (const m of [0, -5, 721, 1.5, NaN]) { const r = await finalizarCronometro('tempo', m as number); expect(r.ok).toBe(false); expect(r.erro).toContain('1 a 720') }
    expect(h.rpcs).toHaveLength(0); expect(h.chamadas).not.toContain('cronometros.delete')
  })
  it('sem cronômetro em andamento', async () => { h.tabelas.cronometros = { data: null }; expect((await finalizarCronometro('tempo', 10)).erro).toContain('Não há') })
  it('se concluir falhar, o cronômetro é MANTIDO (nada de perder o tempo)', async () => {
    h.tabelas.cronometros = { data: crono() }; h.tabelas.topics = { data: { status: 'planejado' } }; h.flowErro = 'falhou'
    const r = await finalizarCronometro('concluir', 40)
    expect(r.ok).toBe(false); expect(r.erro).toContain('mantido'); expect(h.chamadas).not.toContain('cronometros.delete')
  })
  it('se registrar o tempo falhar, o cronômetro é mantido', async () => {
    h.tabelas.cronometros = { data: crono({ tipo: 'livre' }) }; h.rpcRes.registrar_dia = { data: null, error: { code: 'x' } }
    expect((await finalizarCronometro('tempo', 40)).ok).toBe(false); expect(h.chamadas).not.toContain('cronometros.delete')
  })
})

describe('descartar', () => { it('apaga sem registrar nada', async () => { expect(await descartarCronometro()).toEqual({ ok: true }); expect(h.rpcs).toHaveLength(0); expect(h.chamadas).toContain('cronometros.delete') }) })
