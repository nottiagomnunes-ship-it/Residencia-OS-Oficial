import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({ ops: [] as { op: string; arg?: any; filtro?: any }[], selecao: { data: [] as any[], error: null as any }, erroUpdate: null as any, revalidadas: [] as string[] }))
const chain = () => {
  let op = 'select', arg: any, filtro: any
  const c: any = new Proxy({}, { get: (_, k: string) => {
    if (k === 'then') return (ok: any) => ok(op === 'select' ? h.selecao : { data: null, error: h.erroUpdate })
    if (k === 'update') return (a: any) => { op = 'update'; arg = a; return c }
    if (k === 'in' || k === 'eq') return (col: string, v: any) => { filtro = { col, v }; if (op === 'update') h.ops.push({ op, arg, filtro }); return c }
    return () => c
  } })
  return c
}
vi.mock('@/lib/supabase/server', () => ({ supabaseServer: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) }, from: () => chain() }) }))
vi.mock('next/cache', () => ({ revalidatePath: (p: string) => { h.revalidadas.push(p) } }))
vi.mock('next/navigation', () => ({ redirect: (u: string) => { throw new Error('REDIRECT ' + u) } }))
import { carregarAreas, comArea, atribuirAreasPorNome } from './areas-data'
import { definirArea, aplicarAreas } from './areas'

const sb = (): any => ({ from: () => chain() })
const U = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
beforeEach(() => { h.ops.length = 0; h.selecao = { data: [], error: null }; h.erroUpdate = null; h.revalidadas.length = 0 })

describe('carregarAreas', () => {
  it('devolve a área de cada disciplina por id; valor inválido vira "sem área"', async () => {
    h.selecao = { data: [{ id: 'a', area: 'clinica' }, { id: 'b', area: null }, { id: 'c', area: 'inventada' }], error: null }
    expect(await carregarAreas(sb())).toEqual({ disponivel: true, mapa: { a: 'clinica', b: null, c: null } })
  })
  it('se a atualização do banco ainda não foi aplicada, não quebra: "indisponível" e mapa vazio', async () => {
    h.selecao = { data: null as any, error: { code: '42703', message: 'column "area" does not exist' } }; expect(await carregarAreas(sb())).toEqual({ disponivel: false, mapa: {} })
  })
  it('comArea junta a disciplina e a sua área (sem área quando não há)', () => { expect(comArea([{ id: 'a', nome: 'X' }, { id: 'z', nome: 'Y' }], { a: 'go' })).toEqual([{ id: 'a', nome: 'X', area: 'go' }, { id: 'z', nome: 'Y', area: null }]) })
})

describe('atribuirAreasPorNome: só as disciplinas que acabaram de nascer', () => {
  const todas = [
    { id: 'novo1', nome: 'Cardiologia', area: null }, { id: 'novo2', nome: 'Nefrologia', area: null }, { id: 'novo3', nome: 'Trauma', area: null }, { id: 'novo4', nome: 'Imunizações', area: null },
    { id: 'velha1', nome: 'Pneumologia', area: null },           // já existia, sem área: a pessoa ainda não revisou, NÃO é tocada
    { id: 'velha2', nome: 'Obstetrícia', area: 'go' },
  ]
  it('dá a área sugerida só às nomeadas, uma gravação por área', async () => {
    h.selecao = { data: todas, error: null }; const n = await atribuirAreasPorNome(sb(), ['Cardiologia', 'Nefrologia', 'Trauma'])
    expect(n).toBe(3); expect(h.ops).toEqual([{ op: 'update', arg: { area: 'clinica' }, filtro: { col: 'id', v: ['novo1', 'novo2'] } }, { op: 'update', arg: { area: 'cirurgia' }, filtro: { col: 'id', v: ['novo3'] } }])
  })
  it('as que já existiam sem área e as que já têm área não são tocadas', async () => { h.selecao = { data: todas, error: null }; await atribuirAreasPorNome(sb(), ['Cardiologia']); expect(JSON.stringify(h.ops)).not.toContain('velha') })
  it('nome ambíguo (sem sugestão) fica sem área, sem gravar nada', async () => { h.selecao = { data: todas, error: null }; expect(await atribuirAreasPorNome(sb(), ['Imunizações'])).toBe(0); expect(h.ops).toHaveLength(0) })
  it('compara sem se importar com acentos, maiúsculas e espaços', async () => { h.selecao = { data: todas, error: null }; expect(await atribuirAreasPorNome(sb(), ['  CARDIOLOGIA '])).toBe(1) })
  it('sem nomes, nem consulta o banco', async () => { expect(await atribuirAreasPorNome(sb(), [])).toBe(0); expect(await atribuirAreasPorNome(sb(), ['', '   '])).toBe(0); expect(h.ops).toHaveLength(0) })
  it('banco sem o campo (atualização não aplicada) ou com erro: ignora, devolve 0 e não estoura', async () => {
    h.selecao = { data: null as any, error: { code: '42703' } }; expect(await atribuirAreasPorNome(sb(), ['Cardiologia'])).toBe(0)
    h.selecao = { data: todas, error: null }; h.erroUpdate = { code: 'x' }; expect(await atribuirAreasPorNome(sb(), ['Cardiologia'])).toBe(0)
  })
})

describe('definirArea', () => {
  it('define a área de uma disciplina e atualiza as telas que a mostram', async () => {
    expect(await definirArea(U(1), 'clinica')).toEqual({ ok: true }); expect(h.ops).toEqual([{ op: 'update', arg: { area: 'clinica' }, filtro: { col: 'id', v: U(1) } }])
    expect(h.revalidadas).toEqual(expect.arrayContaining(['/disciplinas', '/desempenho', '/conteudos', '/questoes']))
  })
  it('null tira a área', async () => { expect((await definirArea(U(1), null)).ok).toBe(true); expect(h.ops[0].arg).toEqual({ area: null }) })
  it('área ou id inválidos são recusados antes de tocar no banco', async () => {
    for (const [id, a] of [[U(1), 'invalida'], [U(1), ''], ['x', 'go'], ['', 'go'], [U(1), 5 as any], [undefined as any, 'go']]) { const r = await definirArea(id as string, a as any); expect(r.ok).toBe(false) }
    expect(h.ops).toHaveLength(0)
  })
  it('erro do banco (campo ainda não existe): mensagem que diz o que fazer, e as telas não são atualizadas', async () => {
    h.erroUpdate = { code: '42703' }; const r = await definirArea(U(1), 'go'); expect(r.ok).toBe(false); expect(r.erro).toContain('SQL 0027'); expect(h.revalidadas).toHaveLength(0)
  })
})

describe('aplicarAreas', () => {
  it('agrupa por área: uma gravação por área, sem repetir ids', async () => {
    const r = await aplicarAreas([{ id: U(1), area: 'clinica' }, { id: U(2), area: 'clinica' }, { id: U(1), area: 'clinica' }, { id: U(3), area: 'go' }, { id: U(4), area: null }])
    expect(r).toEqual({ ok: true, aplicadas: 4 }); expect(h.ops).toEqual([
      { op: 'update', arg: { area: 'clinica' }, filtro: { col: 'id', v: [U(1), U(2)] } }, { op: 'update', arg: { area: 'go' }, filtro: { col: 'id', v: [U(3)] } }, { op: 'update', arg: { area: null }, filtro: { col: 'id', v: [U(4)] } }])
    expect(h.revalidadas).toContain('/desempenho')
  })
  it('um item inválido no meio: NADA é gravado', async () => {
    for (const ruim of [{ id: 'x', area: 'go' }, { id: U(2), area: 'outra' }, null, { area: 'go' }]) { h.ops.length = 0; const r = await aplicarAreas([{ id: U(1), area: 'clinica' }, ruim as any]); expect(r.ok).toBe(false); expect(r.erro).toContain('Nada foi alterado'); expect(h.ops).toHaveLength(0) }
  })
  it('vazio, que não é lista ou grande demais: recusa', async () => {
    expect((await aplicarAreas([])).ok).toBe(false); expect((await aplicarAreas('x' as any)).ok).toBe(false); expect((await aplicarAreas(Array.from({ length: 501 }, (_, i) => ({ id: U(i + 1), area: 'go' })))).ok).toBe(false); expect(h.ops).toHaveLength(0)
  })
  it('falha no banco: avisa o que fazer e não atualiza as telas', async () => { h.erroUpdate = { code: '42703' }; const r = await aplicarAreas([{ id: U(1), area: 'go' }]); expect(r.ok).toBe(false); expect(r.erro).toContain('SQL 0027'); expect(h.revalidadas).toHaveLength(0) })
})
