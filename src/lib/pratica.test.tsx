import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const h = vi.hoisted(() => ({ dados: {} as Record<string, any>, filtros: [] as string[], rpcs: [] as { nome: string; args: any }[], rpcRes: null as any }))
const cadeia = (t: string) => {
  const r: any = {}
  for (const m of ['select', 'order', 'limit']) r[m] = () => r
  for (const m of ['eq', 'not', 'or']) r[m] = (...a: any[]) => { h.filtros.push(`${m}(${a.join(',')})`); return r }
  r.maybeSingle = async () => ({ data: h.dados[t + ':um'] ?? null, error: null })
  r.then = (ok: any) => Promise.resolve({ data: h.dados[t] ?? [], error: null }).then(ok)
  return r
}
vi.mock('@/lib/supabase/server', () => ({ supabaseServer: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) }, from: (t: string) => cadeia(t),
  rpc: async (nome: string, args: any) => { h.rpcs.push({ nome, args }); return h.rpcRes ?? { data: null, error: { message: 'x' } } },
  storage: { from: () => ({ createSignedUrls: async () => ({ data: [] }) }) },
}) }))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({ redirect: () => { throw new Error('REDIRECT') }, useRouter: () => ({ refresh: () => {} }) }))
vi.mock('@/lib/dates', () => ({ hojeBR: () => '2026-10-05' }))
vi.mock('@/lib/gamificacao-data', () => ({ carregarGamificacao: async () => {} }))

import { proximaQuestao, responderPratica } from './pratica'
import Praticar from '@/components/banco/Praticar'

const ID = (n: number) => `00000000-0000-0000-0000-00000000000${n}`
const questao = { id: ID(1), blocos: [{ tipo: 'texto', texto: 'Qual o jejum para leite materno?' }], alternativas: [{ letra: 'A', texto: '2 h' }, { letra: 'B', texto: '4 h' }], gabarito: 'B', banca: 'UNICAMP', ano: 2016, assunto: null, vezes: 0, acertos: 0 }
beforeEach(() => { h.dados = {}; h.filtros = []; h.rpcs = []; h.rpcRes = null })

describe('próxima questão', () => {
  it('só com gabarito e não anuladas, sem as já vistas; a questão chega SEM o gabarito', async () => {
    h.dados.banco_questoes = [{ id: ID(1), vezes: 0, ultimo_certo: null, ultima_em: null }, { id: ID(2), vezes: 3, ultimo_certo: true, ultima_em: '2026-10-01' }]
    h.dados['banco_questoes:um'] = questao
    const r = await proximaQuestao({ disciplina: ID(9), situacao: 'nunca' }, [ID(3), 'lixo'])
    expect(h.filtros).toEqual(expect.arrayContaining(['eq(anulada,false)', 'not(gabarito,is,)', `eq(discipline_id,${ID(9)})`, 'eq(vezes,0)', `not(id,in,(${ID(3)}))`]))
    expect(r.restantes).toBe(2); expect(r.questao?.id).toBe(ID(1))
    expect(r.questao).not.toHaveProperty('gabarito'); expect(JSON.stringify(r.questao)).not.toContain('"gabarito"')
  })
  it('acabou: questão nula', async () => { expect(await proximaQuestao({}, [])).toEqual({ questao: null, restantes: 0 }) })
})

describe('responder', () => {
  it('corrige pelo banco (gravação única) e manda o texto da questão para o caderno', async () => {
    h.dados['banco_questoes:um'] = questao
    h.rpcRes = { data: { correta: false, gabarito: 'B', gabarito_origem: 'oficial', comentario: 'Pela SBA, 4 h.', erro_id: 'e1', xp: 0 }, error: null }
    const r = await responderPratica(ID(1), 'A', false)
    expect(r).toEqual({ ok: true, correcao: { correta: false, gabarito: 'B', gabaritoIA: false, comentario: 'Pela SBA, 4 h.', erroId: 'e1', xp: 0 } })
    expect(h.rpcs[0].args).toMatchObject({ p_questao: ID(1), p_alt: 'A', p_chute: false, p_dia: '2026-10-05' })
    expect(h.rpcs[0].args.p_texto).toBe('UNICAMP 2016\n\nQual o jejum para leite materno?\n\nA) 2 h\nB) 4 h\n\nSua resposta: A · Gabarito: B')
  })
  it('recusa letra ou id inválidos sem gravar; sem a 0035, diz o que rodar', async () => {
    expect(await responderPratica('x', 'A', false)).toMatchObject({ ok: false }); expect(await responderPratica(ID(1), 'Z', false)).toMatchObject({ ok: false })
    expect(h.rpcs).toEqual([])
    h.dados['banco_questoes:um'] = questao; h.rpcRes = { data: null, error: { message: 'Could not find the function public.responder_pratica' } }
    expect(await responderPratica(ID(1), 'A', false)).toEqual({ ok: false, erro: expect.stringContaining('0035_praticar.sql') })
  })
})

describe('tela', () => {
  const q = { ...questao, blocos: [{ tipo: 'texto' as const, texto: 'Qual o jejum?' }], alternativas: [{ letra: 'A' as const, texto: '2 h' }, { letra: 'B' as const, texto: '4 h' }] }
  it('antes de responder: enunciado, alternativas, "Responder" desligado e nenhum sinal do gabarito', () => {
    const { gabarito: _g, ...semGab } = q
    const html = renderToStaticMarkup(<Praticar filtros={{}} titulo="Anestesiologia" inicial={semGab as never} total={12} />)
    expect(html).toContain('Praticar: Anestesiologia'); expect(html).toContain('Qual o jejum?'); expect(html).toContain('12 questões nestes filtros')
    expect(html).toMatch(/disabled=""[^>]*>Responder/); expect(html).not.toContain('A correta')
  })
  it('sem questões: diz isso e oferece mudar os filtros', () => {
    const html = renderToStaticMarkup(<Praticar filtros={{}} titulo="x" inicial={null} total={0} />)
    expect(html).toContain('Nenhuma questão com gabarito bate com esses filtros'); expect(html).toContain('href="/banco"')
  })
})
