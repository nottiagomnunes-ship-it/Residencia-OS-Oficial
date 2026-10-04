import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const h = vi.hoisted(() => ({ dados: {} as Record<string, any>, rpcs: [] as { nome: string; args: any }[], filtros: [] as string[], redirects: [] as string[], rpcRes: {} as Record<string, any> }))
const cadeia = (t: string) => {
  const r: any = {}
  for (const m of ['select', 'order', 'limit', 'range', 'in']) r[m] = () => r
  for (const m of ['eq', 'not', 'neq']) r[m] = (...a: any[]) => { h.filtros.push(`${t}.${m}(${a.join(',')})`); return r }
  r.maybeSingle = async () => ({ data: h.dados[t + ':um'] ?? null, error: null })
  r.single = r.maybeSingle
  r.then = (ok: any) => Promise.resolve({ data: h.dados[t] ?? [], error: null }).then(ok)
  r.delete = () => r
  return r
}
vi.mock('@/lib/supabase/server', () => ({ supabaseServer: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: '11111111-1111-1111-1111-111111111111' } } }) }, from: (t: string) => cadeia(t),
  rpc: async (nome: string, args: any) => { h.rpcs.push({ nome, args }); return h.rpcRes[nome] ?? { data: null, error: null } },
  storage: { from: () => ({ createSignedUrls: async () => ({ data: [] }), remove: async () => ({}) }) },
}) }))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({ redirect: (u: string) => { h.redirects.push(u); throw new Error('REDIRECT') }, useRouter: () => ({ refresh: () => {}, push: () => {} }) }))
vi.mock('@/lib/dates', () => ({ hojeBR: () => '2026-10-04' }))
vi.mock('@/lib/gamificacao-data', () => ({ carregarGamificacao: async () => {} }))

import { importarNoBanco, montarLista } from './banco'
import { entregarProva } from './provas'
import ImportarBanco from '@/components/banco/ImportarBanco'

const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f }
const q = (texto: string, o: object = {}) => ({ blocos: [{ tipo: 'texto', texto }], alternativas: [{ letra: 'A', texto: 'a' }, { letra: 'B', texto: 'b' }], gabarito: 'A', ...o })
beforeEach(() => { h.dados = {}; h.rpcs = []; h.filtros = []; h.redirects = []; h.rpcRes = {} })

describe('importar no banco', () => {
  it('manda cada questão com a impressão digital; o banco diz quantas eram novas', async () => {
    h.rpcRes.importar_banco = { data: 1, error: null }
    expect(await importarNoBanco({ questoes: [q('Qual a conduta?'), q('QUAL  a conduta')] })).toEqual({ ok: true, novas: 1, repetidas: 1 })
    const itens = h.rpcs[0].args.p_itens
    expect(itens).toHaveLength(2); expect(itens[0].hash).toMatch(/^[0-9a-f]{64}$/); expect(itens[0].hash).toBe(itens[1].hash)
  })
  it('lotes grandes vão em partes de 200', async () => {
    h.rpcRes.importar_banco = { data: 200, error: null }
    await importarNoBanco({ questoes: Array.from({ length: 450 }, (_, i) => q(`Questão número ${i}`)) })
    expect(h.rpcs.map(r => r.args.p_itens.length)).toEqual([200, 200, 50])
  })
  it('sem a 0034: diz o que rodar', async () => {
    h.rpcRes.importar_banco = { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } }
    expect(await importarNoBanco({ questoes: [q('x')] })).toEqual({ ok: false, erro: expect.stringContaining('0034_banco_questoes.sql') })
  })
})

describe('montar lista', () => {
  it('filtra (só com gabarito, não anuladas), sorteia e abre a tentativa', async () => {
    h.dados.banco_questoes = Array.from({ length: 30 }, (_, i) => ({ id: `q${i}` }))
    h.rpcRes.montar_lista = { data: 'tent-1', error: null }
    await expect(montarLista(fd({ area: 'cirurgia', situacao: 'nunca', quantidade: '10', banca: 'UFMA' }))).rejects.toThrow('REDIRECT')
    expect(h.redirects.at(-1)).toBe('/provas/tentativa/tent-1')
    expect(h.filtros).toEqual(expect.arrayContaining(['banco_questoes.eq(anulada,false)', 'banco_questoes.not(gabarito,is,)', 'banco_questoes.eq(area,cirurgia)', 'banco_questoes.eq(banca,UFMA)', 'banco_questoes.eq(vezes,0)']))
    const a = h.rpcs.find(r => r.nome === 'montar_lista')!.args
    expect(a.p_ids).toHaveLength(10); expect(new Set(a.p_ids).size).toBe(10); expect(a.p_nome).toBe('UFMA · 10 questões')
  })
  it('nada bate com os filtros: avisa e não cria lista', async () => {
    await expect(montarLista(fd({ quantidade: '10' }))).rejects.toThrow('REDIRECT')
    expect(decodeURIComponent(h.redirects.at(-1)!)).toContain('Nenhuma questão com gabarito')
    expect(h.rpcs).toEqual([])
  })
})

describe('corrigir uma lista', () => {
  it('vai para corrigir_lista com o XP de "Registrar questões" (não o de simulado)', async () => {
    const T = '33333333-3333-3333-3333-333333333333', P = '22222222-2222-2222-2222-222222222222'
    h.dados['prova_tentativas:um'] = { id: T, prova_id: P, status: 'entregue' }
    h.dados['provas:um'] = { id: P, nome: 'Anestesiologia · 2 questões', tipo: 'lista' }
    h.dados.prova_questoes = [
      { id: 'a', numero: 1, blocos: [{ tipo: 'texto', texto: 'Um' }], alternativas: [{ letra: 'A', texto: 'a' }, { letra: 'B', texto: 'b' }], gabarito: 'A', anulada: false },
      { id: 'b', numero: 2, blocos: [{ tipo: 'texto', texto: 'Dois' }], alternativas: [{ letra: 'A', texto: 'a' }, { letra: 'B', texto: 'b' }], gabarito: 'B', anulada: false }]
    h.dados.prova_respostas = [{ questao_id: 'a', alternativa: 'A', chute: false }, { questao_id: 'b', alternativa: 'A', chute: false }]
    await expect(entregarProva(T, 60)).rejects.toThrow('REDIRECT')
    const r = h.rpcs.find(x => x.nome.startsWith('corrigir'))!
    expect(r.nome).toBe('corrigir_lista'); expect(r.args).toMatchObject({ p_total: 2, p_acertos: 1, p_xp: 1 })
  })
})

describe('tela de importar', () => {
  it('começa só com a escolha do arquivo (PDF, .docx ou .json)', () => {
    const html = renderToStaticMarkup(<ImportarBanco disciplinas={[]} assuntos={[]} />)
    expect(html).toContain('accept=".pdf,.docx,.json'); expect(html).not.toContain('Adicionar')
  })
})
