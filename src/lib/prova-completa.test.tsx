import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const h = vi.hoisted(() => ({
  admin: false, ops: [] as { t: string; tipo: string; dados?: any; filtros: string[] }[],
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
  r.update = (d: any) => { const op = { t, tipo: 'update', dados: d, filtros }; h.ops.push(op); return r }
  r.delete = () => { h.ops.push({ t, tipo: 'delete', filtros }); return r }
  r.maybeSingle = r.single = async () => ({ data: h.um[`${t}:${campos}`] ?? h.um[t] ?? null, error: null })
  r.then = (ok: any) => Promise.resolve(h.resp(t, campos, filtros)).then(ok)
  return r
}
vi.mock('@/lib/supabase/server', () => ({ supabaseServer: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) }, from: (t: string) => cadeia(t),
  rpc: async (nome: string, args: any) => { h.rpcs.push({ nome, args }); return nome === 'eh_admin' ? { data: h.admin, error: null } : nome === 'sincronizar_banco_geral' ? { data: null, error: null } : h.rpc(nome, args) },
  storage: { from: () => ({ createSignedUrls: async () => ({ data: [] }) }) },
}) }))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({ redirect: (u: string) => { h.redirects.push(u); throw new Error('REDIRECT') }, notFound: () => { throw new Error('NOT_FOUND') } }))

import { fazerProvaDoBanco } from './banco'
import { cadastrarProvaExistente, salvarProvaGeral, tirarDaProva, excluirProvaGeral } from './provas-geral'
import { carregarProva } from './provas-data'
import { supabaseServer } from './supabase/server'
import { provasParaFazer, numerosQueFaltam, palpiteDaProva, gruposSemProva } from './engine/provas-banco'
import { numeroValido, lerPacote, validarLote, itensDeQuestoes } from './engine/banco'
import Provas from '@/app/(app)/provas/page'
import Prova from '@/app/(app)/provas/[id]/page'
import ProvasAdmin from '@/app/(app)/admin/provas/page'
import ProvaAdmin from '@/app/(app)/admin/provas/[id]/page'

const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.append(k, v); return f }
beforeEach(() => { Object.assign(h, { admin: false, ops: [], redirects: [], rpcs: [], um: {}, rpc: () => ({ data: 'tent-1', error: null }), resp: () => ({ data: [], error: null }) }) })

describe('o número da questão na prova', () => {
  it('aceita 1 a 999 (também em texto)', () => {
    expect([numeroValido(7), numeroValido('12'), numeroValido(' 3 '), numeroValido(0), numeroValido(1000), numeroValido('1a'), numeroValido(2.5), numeroValido(null)]).toEqual([7, 12, 3, null, null, null, null, null])
  })
  it('pacote com o cadastro da prova ("prova": nome e total)', () => {
    const l = lerPacote({ formato: 'residencia-os/banco', versao: 1, prova: { nome: ' USP-SP 2025 – Acesso direto ', total: 100 }, questoes: [{ enunciado: 'Um', alternativas: ['a', 'b'], numero: 1 }] })
    expect(l.prova).toEqual({ nome: 'USP-SP 2025 – Acesso direto', total: 100 })
    expect(lerPacote({ questoes: [{ enunciado: 'Um', alternativas: ['a', 'b'] }] }).prova).toBeNull()
    expect(lerPacote({ prova: { total: 999 }, questoes: [{ enunciado: 'Um', alternativas: ['a', 'b'] }] }).prova).toEqual({ nome: null, total: null })
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
  const PG = [{ id: 'a', nome: 'X 2025 – Acesso direto', banca: 'X', ano: 2025, total: 3 }, { id: 'b', nome: 'X 2025 – R+', banca: 'X', ano: 2025, total: 1 },
    { id: 'c', nome: 'Y 2026', banca: 'Y', ano: 2026, total: 2 }, { id: 'd', nome: 'Z 2020', banca: 'Z', ano: 2020, total: 5 }]
  const L = [{ prova_id: 'a', geral_id: 'g1', numero: 1 }, { prova_id: 'a', geral_id: 'g2', numero: 2 }, { prova_id: 'a', geral_id: 'g3', numero: 3 },
    { prova_id: 'b', geral_id: 'g4', numero: 1 }, { prova_id: 'c', geral_id: 'g5', numero: 1 }, { prova_id: 'c', geral_id: 'g6', numero: 2 }, { prova_id: 'd', geral_id: 'g9', numero: 1 }]
  it('só as provas cadastradas, separadas mesmo com banca e ano iguais; completa ou "N de total"; sem nenhuma questão, não aparece', () => {
    const minhas = [{ origem_geral: 'g1', gabarito: 'A', anulada: false }, { origem_geral: 'g2', gabarito: null, anulada: true }, { origem_geral: 'g3', gabarito: null, anulada: false },
      { origem_geral: 'g4', gabarito: 'B', anulada: false }, { origem_geral: 'g5', gabarito: 'A', anulada: false }, { origem_geral: 'g6', gabarito: 'C', anulada: false }]
    expect(provasParaFazer(PG, L, minhas).map(p => [p.nome, p.disponiveis, p.completa])).toEqual([['Y 2026', 2, true], ['X 2025 – Acesso direto', 2, false], ['X 2025 – R+', 1, true]])
  })
  it('números que faltam, palpite do cadastro e grupos sem prova (Administração)', () => {
    expect(numerosQueFaltam(6, [1, 2, 5])).toEqual([3, 4, 6])
    expect(palpiteDaProva([{ banca: 'UFMA', ano: 2024, numero: 3 }, { banca: 'UFMA', ano: 2024, numero: 100 }, { banca: 'X', ano: 2020, numero: null }])).toEqual({ banca: 'UFMA', ano: 2024, nome: 'UFMA 2024', total: 100 })
    const g = gruposSemProva([{ id: '1', banca: 'X', ano: 2025, colecao: 'AD', numero: 1 }, { id: '2', banca: 'X', ano: 2025, colecao: 'AD', numero: 7 }, { id: '3', banca: 'X', ano: 2025, colecao: 'R+', numero: 1 },
      { id: '4', banca: 'X', ano: 2025, colecao: 'AD', numero: 2 }, { id: '5', banca: null, ano: 2025, colecao: null, numero: 1 }], new Set(['4']))
    expect(g).toEqual([{ banca: 'X', ano: 2025, colecao: 'AD', questoes: 2, maior: 7 }, { banca: 'X', ano: 2025, colecao: 'R+', questoes: 1, maior: 1 }])
  })
  it('fazer a prova: atualiza o banco, monta pela prova cadastrada e abre a tentativa', async () => {
    const P = '12345678-1234-1234-1234-123456789abc'
    await expect(fazerProvaDoBanco(fd({ prova: P, volta: '/provas' }))).rejects.toThrow('REDIRECT')
    expect(h.rpcs.map(x => x.nome)).toEqual(['sincronizar_banco_geral', 'montar_prova_do_banco']); expect(h.rpcs[1].args).toEqual({ p_prova: P })
    expect(h.redirects).toEqual(['/provas/tentativa/tent-1'])
  })
  it('erros voltam para a página de onde veio (só endereços do app) com a mensagem certa', async () => {
    const P = '12345678-1234-1234-1234-123456789abc'
    h.rpc = () => ({ data: null, error: { message: 'Could not find the function public.montar_prova_do_banco' } })
    await expect(fazerProvaDoBanco(fd({ prova: P, volta: '/banco/questoes?banca=UFMA' }))).rejects.toThrow('REDIRECT')
    expect(decodeURIComponent(h.redirects.at(-1)!)).toBe('/banco/questoes?banca=UFMA&erro=Falta atualizar o banco: rode supabase/migrations/0050_provas_do_banco.sql no SQL Editor do Supabase.')
    h.rpc = () => ({ data: null, error: { message: 'Nenhuma questão dessa prova no seu banco' } })
    await expect(fazerProvaDoBanco(fd({ prova: P, volta: 'https://fora.com' }))).rejects.toThrow('REDIRECT')
    expect(decodeURIComponent(h.redirects.at(-1)!)).toBe('/provas?erro=Nenhuma questão com gabarito dessa prova no seu banco.')
    await expect(fazerProvaDoBanco(fd({ prova: 'x' }))).rejects.toThrow('REDIRECT')
    expect(decodeURIComponent(h.redirects.at(-1)!)).toContain('Escolha a prova')
  })
})

describe('Administração → Provas', () => {
  const P = '12345678-1234-1234-1234-123456789abc'
  it('só a administradora', async () => {
    await expect(cadastrarProvaExistente(fd({ nome: 'X', banca: 'X', ano: '2025', total: '10' }))).rejects.toThrow('REDIRECT')
    await expect(ProvasAdmin({ searchParams: Promise.resolve({}) })).rejects.toThrow('REDIRECT')
    expect(h.redirects).toEqual(['/banco', '/banco']); expect(h.rpcs.filter(x => x.nome !== 'eh_admin')).toEqual([])
  })
  it('cadastrar com o que já está no banco: confere os campos e abre a prova', async () => {
    h.admin = true
    await expect(cadastrarProvaExistente(fd({ nome: 'X', banca: 'X', ano: '2025', total: '10' }))).rejects.toThrow('REDIRECT')
    expect(decodeURIComponent(h.redirects.at(-1)!)).toContain('Dê um nome')
    await expect(cadastrarProvaExistente(fd({ nome: 'X 2025', banca: 'X', ano: '2025', total: '400' }))).rejects.toThrow('REDIRECT')
    expect(decodeURIComponent(h.redirects.at(-1)!)).toContain('1 a 300')
    h.rpc = () => ({ data: { id: P, ligadas: 8 }, error: null })
    await expect(cadastrarProvaExistente(fd({ nome: ' X 2025 – R+ ', banca: 'X', ano: '2025', total: '10', colecao: 'R+' }))).rejects.toThrow('REDIRECT')
    expect(h.rpcs.at(-1)).toEqual({ nome: 'cadastrar_prova_existente', args: { p_nome: 'X 2025 – R+', p_banca: 'X', p_ano: 2025, p_total: 10, p_colecao: 'R+' } })
    expect(decodeURIComponent(h.redirects.at(-1)!)).toBe(`/admin/provas/${P}?ok=Prova cadastrada com 8 de 10 questões.`)
  })
  it('editar, tirar uma questão e apagar o cadastro', async () => {
    h.admin = true
    await expect(salvarProvaGeral(fd({ id: P, nome: 'X 2025 – AD', banca: 'X', ano: '2025', total: '100' }))).rejects.toThrow('REDIRECT')
    expect(h.ops[0]).toMatchObject({ t: 'provas_geral', tipo: 'update', dados: { nome: 'X 2025 – AD', banca: 'X', ano: 2025, total: 100 }, filtros: [`eq(id,${P})`] })
    await expect(tirarDaProva(fd({ prova: P, numero: '7' }))).rejects.toThrow('REDIRECT')
    expect(h.ops[1]).toMatchObject({ t: 'prova_geral_questoes', tipo: 'delete', filtros: [`eq(prova_id,${P})`, 'eq(numero,7)'] })
    await expect(excluirProvaGeral(fd({ id: P }))).rejects.toThrow('REDIRECT')
    expect(h.ops[2]).toMatchObject({ t: 'provas_geral', tipo: 'delete' }); expect(decodeURIComponent(h.redirects.at(-1)!)).toContain('As questões continuam no banco')
  })
  it('lista: cadastradas (completa ou não) e grupos com número ainda sem prova', async () => {
    h.admin = true
    h.resp = t => t === 'provas_geral' ? { data: [{ id: 'a', nome: 'X 2025 – AD', banca: 'X', ano: 2025, total: 3 }], error: null }
      : t === 'prova_geral_questoes' ? { data: [{ prova_id: 'a', geral_id: 'g1' }, { prova_id: 'a', geral_id: 'g2' }], error: null }
      : t === 'banco_geral' ? { data: [{ id: 'g1', banca: 'X', ano: 2025, colecao: 'AD', numero: 1 }, { id: 'g7', banca: 'Y', ano: 2026, colecao: null, numero: 40 }], error: null }
      : { data: [], error: null }
    const html = renderToStaticMarkup(await ProvasAdmin({ searchParams: Promise.resolve({}) }))
    expect(html).toContain('X 2025 – AD'); expect(html).toContain('2 de 3 questões (incompleta)')
    expect(html).toContain('Y 2026</b>'); expect(html).toContain('value="40"'); expect(html).not.toMatch(/coleção &quot;AD&quot;/)
  })
  it('uma prova: números que faltam, sem gabarito, editar e tirar', async () => {
    h.admin = true
    h.um = { provas_geral: { id: P, nome: 'X 2025 – AD', banca: 'X', ano: 2025, total: 4 } }
    h.resp = t => t === 'prova_geral_questoes' ? { data: [{ numero: 1, geral_id: 'g1', banco_geral: { blocos: [{ tipo: 'texto', texto: 'Primeira' }], gabarito: 'A', anulada: false } },
        { numero: 3, geral_id: 'g3', banco_geral: { blocos: [{ tipo: 'texto', texto: 'Terceira' }], gabarito: null, anulada: false } }], error: null }
      : t === 'banco_questoes' ? { data: [{ id: 'q1', origem_geral: 'g1' }], error: null } : { data: [], error: null }
    const html = renderToStaticMarkup(await ProvaAdmin({ params: Promise.resolve({ id: P }), searchParams: Promise.resolve({}) }))
    expect(html).toContain('2 de 4 questões'); expect(html).toMatch(/faltam: 2, 4/); expect(html).toMatch(/sem gabarito \(ficam fora da prova\): 3/)
    expect(html).toContain('href="/admin/questoes/q1"'); expect(html).toContain('Primeira')
  })
})

describe('telas', () => {
  const banco = (n: number, banca: string, ano: number) => [...Array(n)].map(() => ({ banca, ano, gabarito: 'A', anulada: false }))
  it('Provas: sem "Importar prova"; as provas cadastradas (incompleta avisa), pedir a prova e a última nota', async () => {
    h.resp = t => t === 'provas_geral' ? { data: [{ id: 'a', nome: 'UFMA 2024 – Acesso direto', banca: 'UFMA', ano: 2024, total: 2 }, { id: 'b', nome: 'UFMA 2024 – R+', banca: 'UFMA', ano: 2024, total: 3 }], error: null }
      : t === 'prova_geral_questoes' ? { data: [{ prova_id: 'a', geral_id: 'g1', numero: 1 }, { prova_id: 'a', geral_id: 'g2', numero: 2 }, { prova_id: 'b', geral_id: 'g3', numero: 1 }], error: null }
      : t === 'banco_questoes' ? { data: ['g1', 'g2', 'g3'].map(g => ({ origem_geral: g, gabarito: 'A', anulada: false })), error: null }
      : t === 'provas' ? { data: [{ id: 'p1', nome: 'UFMA 2024 – Acesso direto', banca: 'UFMA', ano: 2024, do_banco: true, prova_geral: 'a', criada_em: '2026-10-01' }], error: null }
      : t === 'prova_tentativas' ? { data: [{ id: 't1', prova_id: 'p1', status: 'corrigida', acertos: 15, total: 20, corrigida_em: '2026-10-02T10:00:00Z', tempo_seg: 100, atual: 20 }], error: null }
      : { data: [], error: null }
    const html = renderToStaticMarkup(await Provas({ searchParams: Promise.resolve({}) }))
    expect(html).not.toContain('/provas/importar'); expect(html).not.toContain('Importar prova')
    expect(html).toContain('UFMA 2024 – Acesso direto</b>'); expect(html).toContain('2 questões'); expect(html).toContain('Refazer a prova'); expect(html).toContain('15/20 (75%)')
    expect(html).toContain('UFMA 2024 – R+</b>'); expect(html).toContain('1 de 3 questões (incompleta)'); expect(html).toContain('name="prova" value="b"')
    expect(html).toContain('href="/contato?pedir=prova#pedir-prova"'); expect(html).toContain('Suas provas'); expect(html).toContain('>Detalhes<')
  })
  it('Provas sem nenhuma prova no banco: explica', async () => {
    const html = renderToStaticMarkup(await Provas({ searchParams: Promise.resolve({}) }))
    expect(html).toContain('Ainda não há provas no banco')
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
