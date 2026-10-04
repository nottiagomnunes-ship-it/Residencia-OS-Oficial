import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const h = vi.hoisted(() => ({
  redirects: [] as string[], rpcs: [] as { nome: string; args: any }[],
  rpc: (() => ({ data: 'tent-1', error: null })) as (nome: string, args: any) => any,
  resp: (() => ({ data: [], error: null })) as (t: string, campos: string, filtros: string[]) => any,
  um: {} as Record<string, any>,
}))
const cadeia = (t: string) => {
  let campos = ''
  const filtros: string[] = []
  const r: any = {}
  r.select = (c: string) => { campos = c; return r }
  for (const m of ['order', 'limit', 'range', 'or']) r[m] = () => r
  for (const m of ['eq', 'in', 'is', 'not', 'gte', 'lte', 'neq']) r[m] = (...a: any[]) => { filtros.push(`${m}(${a.join(',')})`); return r }
  r.maybeSingle = r.single = async () => ({ data: h.um[`${t}:${campos}`] ?? h.um[t] ?? null, error: null })
  r.then = (ok: any) => Promise.resolve(h.resp(t, campos, filtros)).then(ok)
  return r
}
vi.mock('@/lib/supabase/server', () => ({ supabaseServer: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) }, from: (t: string) => cadeia(t),
  rpc: async (nome: string, args: any) => { h.rpcs.push({ nome, args }); return nome === 'eh_admin' ? { data: false, error: null } : h.rpc(nome, args) },
  storage: { from: () => ({ createSignedUrls: async () => ({ data: [] }) }) },
}) }))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({ redirect: (u: string) => { h.redirects.push(u); throw new Error('REDIRECT') }, notFound: () => { throw new Error('NOT_FOUND') } }))

import { fazerProvaCompleta } from './banco'
import { carregarProva } from './provas-data'
import { supabaseServer } from './supabase/server'
import { provasDoBanco, MINIMO_PROVA } from './engine/provas-banco'
import { numeroValido, lerPacote, validarLote, itensDeQuestoes } from './engine/banco'
import Provas from '@/app/(app)/provas/page'
import Prova from '@/app/(app)/provas/[id]/page'

const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.append(k, v); return f }
beforeEach(() => { Object.assign(h, { redirects: [], rpcs: [], um: {}, rpc: () => ({ data: 'tent-1', error: null }), resp: () => ({ data: [], error: null }) }) })

describe('o número da questão na prova', () => {
  it('aceita 1 a 999 (também em texto)', () => {
    expect([numeroValido(7), numeroValido('12'), numeroValido(' 3 '), numeroValido(0), numeroValido(1000), numeroValido('1a'), numeroValido(2.5), numeroValido(null)]).toEqual([7, 12, 3, null, null, null, null, null])
  })
  it('pacote: vem do campo "numero"; a posição no pacote continua sendo a numeração da prévia', () => {
    const l = lerPacote({ formato: 'residencia-os/banco', versao: 1, questoes: [
      { enunciado: 'Um', alternativas: ['a', 'b'], gabarito: 'A', numero: 41 }, { enunciado: 'Dois', alternativas: ['a', 'b'], gabarito: 'B' }] })
    expect(l.itens.map(i => [i.questao.numero, i.numeroNaProva])).toEqual([[1, 41], [2, null]])
  })
  it('PDF/.docx: o número lido do arquivo', () => {
    const it = itensDeQuestoes([{ numero: 37, blocos: [{ tipo: 'texto', texto: 'Enunciado' }], alternativas: [{ letra: 'A', texto: 'a' }, { letra: 'B', texto: 'b' }] }], new Map())
    expect(it[0].numeroNaProva).toBe(37)
  })
  it('o servidor guarda o número válido e ignora o inválido', () => {
    const q = (numero: unknown) => ({ blocos: [{ tipo: 'texto', texto: 'x' }], alternativas: [{ letra: 'A', texto: 'a' }, { letra: 'B', texto: 'b' }], numero })
    const v = validarLote({ questoes: [q(5), q('abc'), q(undefined)] }, 'u1')
    expect(v.ok && v.questoes.map(x => x.numero)).toEqual([5, null, null])
  })
})

describe('provas do banco', () => {
  it('agrupa por banca e ano, só com gabarito ou anuladas, mais recentes primeiro', () => {
    const p = provasDoBanco([
      { banca: 'UFMA', ano: 2023, gabarito: 'A', anulada: false }, { banca: 'UFMA', ano: 2023, gabarito: null, anulada: true },
      { banca: 'UFMA', ano: 2023, gabarito: null, anulada: false }, { banca: 'USP-SP', ano: 2025, gabarito: 'B', anulada: false },
      { banca: null, ano: 2025, gabarito: 'B', anulada: false }, { banca: 'X', ano: null, gabarito: 'B', anulada: false },
    ])
    expect(p).toEqual([{ banca: 'USP-SP', ano: 2025, questoes: 1 }, { banca: 'UFMA', ano: 2023, questoes: 2 }])
  })
  it('fazer a prova: monta pelo banco e abre a tentativa', async () => {
    await expect(fazerProvaCompleta(fd({ banca: 'UFMA', ano: '2024', volta: '/provas' }))).rejects.toThrow('REDIRECT')
    expect(h.rpcs.at(-1)).toEqual({ nome: 'montar_prova_completa', args: { p_banca: 'UFMA', p_ano: 2024 } })
    expect(h.redirects).toEqual(['/provas/tentativa/tent-1'])
  })
  it('erros voltam para a página de onde veio (só endereços do app) com a mensagem certa', async () => {
    h.rpc = () => ({ data: null, error: { message: 'Could not find the function public.montar_prova_completa' } })
    await expect(fazerProvaCompleta(fd({ banca: 'UFMA', ano: '2024', volta: '/banco/questoes?banca=UFMA' }))).rejects.toThrow('REDIRECT')
    expect(decodeURIComponent(h.redirects.at(-1)!)).toBe('/banco/questoes?banca=UFMA&erro=Falta atualizar o banco: rode supabase/migrations/0048_prova_completa.sql no SQL Editor do Supabase.')
    h.rpc = () => ({ data: null, error: { message: 'Nenhuma questão dessa prova no banco' } })
    await expect(fazerProvaCompleta(fd({ banca: 'UFMA', ano: '2024', volta: 'https://fora.com' }))).rejects.toThrow('REDIRECT')
    expect(decodeURIComponent(h.redirects.at(-1)!)).toBe('/provas?erro=Nenhuma questão com gabarito dessa prova no banco.')
    await expect(fazerProvaCompleta(fd({ banca: '', ano: 'x' }))).rejects.toThrow('REDIRECT')
    expect(decodeURIComponent(h.redirects.at(-1)!)).toContain('Escolha a banca e o ano')
  })
})

describe('telas', () => {
  const banco = (n: number, banca: string, ano: number) => [...Array(n)].map(() => ({ banca, ano, gabarito: 'A', anulada: false }))
  it('Provas: sem "Importar prova"; provas do banco (as pequenas à parte), pedir a prova e a última nota', async () => {
    h.resp = t => t === 'banco_questoes' ? { data: [...banco(MINIMO_PROVA, 'UFMA', 2024), ...banco(3, 'HCPA-RS', 2026)], error: null }
      : t === 'provas' ? { data: [{ id: 'p1', nome: 'UFMA 2024', banca: 'UFMA', ano: 2024, do_banco: true, criada_em: '2026-10-01' }], error: null }
      : t === 'prova_tentativas' ? { data: [{ id: 't1', prova_id: 'p1', status: 'corrigida', acertos: 15, total: 20, corrigida_em: '2026-10-02T10:00:00Z', tempo_seg: 100, atual: 20 }], error: null }
      : { data: [], error: null }
    const html = renderToStaticMarkup(await Provas({ searchParams: Promise.resolve({}) }))
    expect(html).not.toContain('/provas/importar'); expect(html).not.toContain('Importar prova')
    expect(html).toContain('UFMA 2024</b>'); expect(html).toContain(`${MINIMO_PROVA} questões`); expect(html).toContain('Refazer a prova'); expect(html).toContain('15/20 (75%)')
    expect(html).toContain('Provas com poucas questões no banco (1)'); expect(html).toContain('HCPA-RS 2026 · 3')
    expect(html).toContain('href="/contato?pedir=prova#pedir-prova"'); expect(html).toContain('Suas provas'); expect(html).toContain('>Detalhes<')
  })
  it('Provas sem nenhuma prova inteira no banco: explica', async () => {
    const html = renderToStaticMarkup(await Provas({ searchParams: Promise.resolve({}) }))
    expect(html).toContain('Ainda não há prova inteira no banco')
  })
  it('detalhes de uma prova do banco: sem editar gabarito nem áreas, sem "pedir esta prova"', async () => {
    h.um = { 'provas:id,nome,banca,ano,criada_em': { id: 'p1', nome: 'UFMA 2024', banca: 'UFMA', ano: 2024, criada_em: '2026-10-01' }, 'provas:*': { tipo: 'prova', do_banco: true } }
    const html = renderToStaticMarkup(await Prova({ params: Promise.resolve({ id: 'p1' }), searchParams: Promise.resolve({}) }))
    expect(html).toContain('Prova montada a partir do banco'); expect(html).not.toContain('Salvar gabarito'); expect(html).not.toContain('Pedir esta prova')
    h.um['provas:*'] = { tipo: 'prova' } // prova importada antes: continua como era
    const antiga = renderToStaticMarkup(await Prova({ params: Promise.resolve({ id: 'p1' }), searchParams: Promise.resolve({}) }))
    expect(antiga).toContain('Salvar gabarito'); expect(antiga).toContain('Pedir esta prova para o banco')
  })
  it('na correção de uma prova do banco, aparece a explicação (ou o comentário) da questão do banco', async () => {
    h.um = { 'provas:id,nome,banca,ano,criada_em': { id: 'p1', nome: 'UFMA 2024' }, 'provas:*': { tipo: 'prova', do_banco: true } }
    h.resp = (t, c) => t === 'prova_questoes' && c.includes('banco_questoes(*)')
      ? { data: [{ id: 'pq1', banco_questoes: { comentario: 'meu', explicacao: 'Porque sim.', gabarito_origem: 'ia' } }, { id: 'pq2', banco_questoes: { comentario: 'só o meu', gabarito_origem: 'oficial' } }], error: null }
      : t === 'prova_questoes' ? { data: [{ id: 'pq1', numero: 1, blocos: [], alternativas: [], gabarito: 'A' }, { id: 'pq2', numero: 2, blocos: [], alternativas: [], gabarito: 'B' }], error: null }
      : { data: [], error: null }
    const d = await carregarProva(await supabaseServer(), 'p1', false)
    expect(d!.prova.doBanco).toBe(true)
    expect(d!.questoes.map(q => [q.comentario, q.gabaritoIA])).toEqual([['Porque sim.', true], ['só o meu', false]])
  })
})
