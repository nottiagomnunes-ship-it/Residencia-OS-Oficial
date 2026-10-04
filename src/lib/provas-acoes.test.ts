import { describe, it, expect, vi, beforeEach } from 'vitest'

// Supabase de mentira: cada tabela devolve o que estiver em h.dados (os filtros são ignorados); rpc e update ficam registrados.
const h = vi.hoisted(() => ({
  user: { id: '11111111-1111-1111-1111-111111111111' } as { id: string } | null,
  dados: {} as Record<string, unknown[]>, rpcs: [] as { nome: string; args: any }[], updates: [] as { t: string; v: any }[],
  rpcErro: null as null | { message: string; code?: string }, redirects: [] as string[], removidos: [] as string[][],
}))
const cadeia = (t: string) => {
  const r: any = {}
  for (const m of ['select', 'eq', 'neq', 'order', 'in', 'limit']) r[m] = () => r
  r.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: h.dados[t] ?? [], error: null }).then(ok)
  r.maybeSingle = async () => ({ data: (h.dados[t] ?? [])[0] ?? null, error: null })
  r.update = (v: any) => { h.updates.push({ t, v }); return { eq: async () => ({ error: null }) } }
  r.delete = () => ({ eq: () => ({ neq: async () => ({ error: null }), then: (ok: any) => Promise.resolve({ error: null }).then(ok) }) })
  return r
}
vi.mock('@/lib/supabase/server', () => ({ supabaseServer: async () => ({
  auth: { getUser: async () => ({ data: { user: h.user } }) }, from: (t: string) => cadeia(t),
  rpc: async (nome: string, args: any) => { h.rpcs.push({ nome, args }); return { data: nome === 'responder_questao' ? 'ok' : 1, error: h.rpcErro } },
  storage: { from: () => ({ remove: async (p: string[]) => { h.removidos.push(p); return {} }, createSignedUrls: async () => ({ data: [] }) }) },
}) }))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({ redirect: (u: string) => { h.redirects.push(u); throw new Error('REDIRECT ' + u) } }))
vi.mock('@/lib/dates', () => ({ hojeBR: () => '2026-10-03' }))
vi.mock('@/lib/gamificacao-data', () => ({ carregarGamificacao: async () => {} }))
vi.mock('@/lib/xp', () => ({ resolverAlvo: async (_sb: unknown, v: string) => (v.startsWith('t:') ? { topic_id: v.slice(2), discipline_id: 'disc' } : { topic_id: null, discipline_id: v.slice(2) || null }) }))

import { salvarGabarito, entregarProva, classificarErro, responderQuestao } from './provas'

const UID = '11111111-1111-1111-1111-111111111111', PROVA = '22222222-2222-2222-2222-222222222222', TENT = '33333333-3333-3333-3333-333333333333'
const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f }
const redirecionou = async (p: Promise<unknown>) => { await expect(p).rejects.toThrow(/REDIRECT/); return h.redirects.at(-1)! }
const alts = (n: number) => 'ABCDE'.slice(0, n).split('').map(l => ({ letra: l, texto: l.toLowerCase() }))

beforeEach(() => { h.user = { id: UID }; h.dados = {}; h.rpcs = []; h.updates = []; h.rpcErro = null; h.redirects = []; h.removidos = [] })

describe('gabarito', () => {
  it('grava só o lido e avisa a letra que não existe na questão', async () => {
    h.dados.prova_questoes = [{ numero: 1, alternativas: alts(5) }, { numero: 2, alternativas: alts(4) }, { numero: 3, alternativas: alts(4) }]
    const url = await redirecionou(salvarGabarito(fd({ prova: PROVA, gabarito: '1-E 2-E 3-x' })))
    expect(h.rpcs[0]).toEqual({ nome: 'atualizar_questoes_da_prova', args: { p_prova: PROVA, p_itens: [{ numero: 1, gabarito: 'E', anulada: false }, { numero: 3, gabarito: null, anulada: true }] } })
    expect(decodeURIComponent(url)).toContain('erro=Gabarito gravado: 2 questões. Ignorei: letra que não existe na questão: 2.')
  })
  it('texto sem nenhuma resposta não grava nada', async () => {
    h.dados.prova_questoes = [{ numero: 1, alternativas: alts(4) }]
    await redirecionou(salvarGabarito(fd({ prova: PROVA, gabarito: 'nada' })))
    expect(h.rpcs).toEqual([])
  })
})

describe('entregar e corrigir', () => {
  beforeEach(() => {
    h.dados.prova_tentativas = [{ id: TENT, prova_id: PROVA, status: 'entregue' }]
    h.dados.provas = [{ id: PROVA, nome: 'UEPA 2022' }]
    h.dados.prova_questoes = [
      { id: 'q1', numero: 1, blocos: [{ tipo: 'texto', texto: 'Um' }], alternativas: alts(4), gabarito: 'A', anulada: false, area: 'go' },
      { id: 'q2', numero: 2, blocos: [{ tipo: 'texto', texto: 'Dois' }], alternativas: alts(4), gabarito: 'B', anulada: false, area: 'go' },
      { id: 'q3', numero: 3, blocos: [{ tipo: 'texto', texto: 'Três' }], alternativas: alts(4), gabarito: null, anulada: true, area: null },
    ]
    h.dados.prova_respostas = [{ questao_id: 'q1', alternativa: 'A', chute: true }, { questao_id: 'q2', alternativa: 'C', chute: false }]
  })
  it('manda a conta (total, acertos, XP dos simulados) e o texto das que vão para o caderno', async () => {
    const url = await redirecionou(entregarProva(TENT, 600))
    expect(url).toBe(`/provas/tentativa/${TENT}?ok=corrigida`)
    expect(h.rpcs.map(r => r.nome)).toEqual(['entregar_tentativa', 'corrigir_tentativa'])
    const a = h.rpcs[1].args
    expect(a).toMatchObject({ p_tentativa: TENT, p_dia: '2026-10-03', p_total: 2, p_acertos: 1, p_xp: 31 })   // 30 + 1 a cada 2 questões
    expect(Object.keys(a.p_textos)).toEqual(['q1', 'q2'])                                                      // chute certo + errada
    expect(a.p_textos.q2).toBe('UEPA 2022 · Questão 2\n\nDois\n\nA) a\nB) b\nC) c\nD) d\n\nSua resposta: C · Gabarito: B')
  })
  it('sem gabarito completo, só entrega (a página pede o gabarito)', async () => {
    (h.dados.prova_questoes[1] as any).gabarito = null
    expect(await redirecionou(entregarProva(TENT, 10))).toBe(`/provas/tentativa/${TENT}`)
    expect(h.rpcs.map(r => r.nome)).toEqual(['entregar_tentativa'])
  })
  it('falha no banco vira mensagem e nada é dado como corrigido', async () => {
    h.rpcErro = { message: 'A correção mudou enquanto era gravada.' }
    expect(decodeURIComponent(await redirecionou(entregarProva(TENT, 10)))).toContain('O gabarito mudou durante a correção')
  })
})

describe('durante a prova e na correção', () => {
  it('responder: limpa as letras riscadas e recusa ids inválidos', async () => {
    expect(await responderQuestao(TENT, '44444444-4444-4444-4444-444444444444', { alternativa: 'B', chute: false, marcada: true, riscadas: 'ccaZ' }, 12.7, 3)).toEqual({ ok: true, status: 'ok' })
    expect(h.rpcs[0].args).toMatchObject({ p_alt: 'B', p_marcada: true, p_riscadas: 'AC', p_tempo: 12, p_atual: 3 })
    expect(await responderQuestao('x', null, null, 0, 1)).toEqual({ ok: false })
    h.user = null
    expect(await responderQuestao(TENT, null, null, 0, 1)).toEqual({ ok: false, sessao: true })
  })
  it('classificar: motivo válido, disciplina vai para o erro e para a questão da prova', async () => {
    const ERRO = '55555555-5555-5555-5555-555555555555'
    expect(await classificarErro(ERRO, { motivo: 'inventado' })).toEqual({ ok: false })
    h.dados.prova_respostas = [{ questao_id: 'q9' }]
    expect(await classificarErro(ERRO, { motivo: 'falta_atencao', alvo: 't:top1' })).toEqual({ ok: true })
    expect(h.updates).toEqual([{ t: 'error_notebook', v: { motivo: 'falta_atencao', topic_id: 'top1', discipline_id: 'disc' } }, { t: 'prova_questoes', v: { topic_id: 'top1', discipline_id: 'disc' } }])
  })
})
