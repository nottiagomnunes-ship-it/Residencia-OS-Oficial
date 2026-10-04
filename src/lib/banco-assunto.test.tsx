import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

type Op = { t: string; tipo: string; dados?: any; filtros: string[] }
const h = vi.hoisted(() => ({ dados: {} as Record<string, any>, ops: [] as Op[], redirects: [] as string[], filtros: [] as string[] }))
const cadeia = (t: string) => {
  const op: Op = { t, tipo: 'select', filtros: [] }
  const r: any = {}
  for (const m of ['select', 'order', 'limit', 'range', 'not', 'neq', 'or']) r[m] = () => r
  for (const m of ['eq', 'in', 'is']) r[m] = (...a: any[]) => { op.filtros.push(`${m}(${a.map(x => (Array.isArray(x) ? x.join('|') : String(x))).join(',')})`); h.filtros.push(`${t}.${op.filtros.at(-1)}`); return r }
  r.update = (d: any) => { op.tipo = 'update'; op.dados = d; h.ops.push(op); return r }
  r.insert = (d: any) => { op.tipo = 'insert'; op.dados = d; h.ops.push(op); return r }
  r.delete = () => { op.tipo = 'delete'; h.ops.push(op); return r }
  const res = () => (op.tipo === 'update' ? { data: null, count: (op.filtros.find(f => f.startsWith('in('))?.split('|').length ?? 0), error: null }
    : op.tipo === 'insert' ? { data: { id: '99999999-9999-9999-9999-999999999999', ...op.dados }, error: null }
    : { data: h.dados[t] ?? [], count: (h.dados[t] ?? []).length, error: null })
  r.maybeSingle = async () => (op.tipo === 'select' ? { data: (h.dados[t + ':um'] ?? null), error: null } : res())
  r.single = async () => (op.tipo === 'select' ? { data: (h.dados[t + ':um'] ?? null), error: null } : res())
  r.then = (ok: any) => Promise.resolve(res()).then(ok)
  return r
}
vi.mock('@/lib/supabase/server', () => ({ supabaseServer: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: '11111111-1111-1111-1111-111111111111' } } }) }, from: (t: string) => cadeia(t),
  rpc: async () => ({ data: null, error: null }), storage: { from: () => ({ createSignedUrls: async () => ({ data: [] }) }) },
}) }))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({ redirect: (u: string) => { h.redirects.push(u); throw new Error('REDIRECT') }, useRouter: () => ({ refresh: () => {}, push: () => {} }) }))

import { definirAssuntoDoBanco, definirAssuntoEmLote, sugerirAssuntosDoBanco } from './banco'
import AssuntoDaQuestao from '@/components/banco/AssuntoDaQuestao'
import Banco from '@/app/(app)/banco/questoes/page'
import PraticarInicio from '@/app/(app)/banco/page'

const Q1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', Q2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const DISC = 'dddddddd-dddd-dddd-dddd-dddddddddddd', TOP = 'tttttttt-tttt-tttt-tttt-tttttttttttt'.replace(/t/g, 'e')
const fd = (o: Record<string, string | string[]>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) for (const x of [v].flat()) f.append(k, x); return f }
const updates = () => h.ops.filter(o => o.t === 'banco_questoes' && o.tipo === 'update')
beforeEach(() => { h.dados = {}; h.ops = []; h.redirects = []; h.filtros = [] })

describe('definir o assunto das questões do banco', () => {
  it('com um assunto de Matérias: liga a questão a ele e à disciplina dele', async () => {
    h.dados['topics:um'] = { id: TOP, nome: 'Anestésicos locais', discipline_id: DISC }
    expect(await definirAssuntoDoBanco([Q1, Q2, 'lixo'], { topic_id: TOP })).toMatchObject({ ok: true, n: 2 })
    expect(updates()[0].dados).toEqual({ topic_id: TOP, assunto: 'Anestésicos locais', discipline_id: DISC })
    expect(updates()[0].filtros).toEqual([`in(id,${Q1}|${Q2})`])
  })
  it('só com um nome: vira rótulo (sem ligação); vazio: tira o assunto', async () => {
    await definirAssuntoDoBanco([Q1], { assunto: '  Bloqueio de neuroeixo ' })
    await definirAssuntoDoBanco([Q1], { assunto: null })
    expect(updates().map(u => u.dados)).toEqual([{ topic_id: null, assunto: 'Bloqueio de neuroeixo' }, { topic_id: null, assunto: null }])
  })
  it('"criar em Matérias": reaproveita o assunto de mesmo nome (sem acento/maiúscula) em vez de duplicar', async () => {
    h.dados.topics = [{ id: TOP, nome: 'Anestésicos Locais', discipline_id: DISC }]
    h.dados['topics:um'] = { id: TOP, nome: 'Anestésicos Locais', discipline_id: DISC }
    const r = await definirAssuntoDoBanco([Q1], { assunto: 'anestesicos locais', criar_em: DISC })
    expect(r.ok).toBe(true); expect(r.topic).toBeUndefined()
    expect(h.ops.some(o => o.tipo === 'insert')).toBe(false)
    expect(updates()[0].dados.topic_id).toBe(TOP)
  })
  it('"criar em Matérias": cria o assunto na disciplina e liga a questão', async () => {
    h.dados['topics:um'] = { id: '99999999-9999-9999-9999-999999999999', nome: 'Via aérea difícil', discipline_id: DISC }
    const r = await definirAssuntoDoBanco([Q1], { assunto: 'Via aérea difícil', criar_em: DISC })
    const ins = h.ops.find(o => o.tipo === 'insert')!
    expect(ins.t).toBe('topics'); expect(ins.dados).toEqual({ user_id: '11111111-1111-1111-1111-111111111111', discipline_id: DISC, nome: 'Via aérea difícil' })
    expect(r.topic).toMatchObject({ nome: 'Via aérea difícil', discipline_id: DISC })
    expect(updates()[0].dados).toMatchObject({ topic_id: '99999999-9999-9999-9999-999999999999', discipline_id: DISC })
  })
  it('sem questão escolhida: não grava nada', async () => {
    expect(await definirAssuntoDoBanco([], { assunto: 'x' })).toEqual({ ok: false, erro: 'Nenhuma questão escolhida.' })
    expect(h.ops).toEqual([])
  })
})

describe('em lote (lista do banco)', () => {
  it('grava nas marcadas e volta para a mesma página com o aviso', async () => {
    h.dados['topics:um'] = { id: TOP, nome: 'Anestésicos locais', discipline_id: DISC }
    await expect(definirAssuntoEmLote(fd({ sel: [Q1, Q2], alvo: `t:${TOP}`, volta: `/banco?disciplina=${DISC}&p=2` }))).rejects.toThrow('REDIRECT')
    expect(h.redirects[0]).toMatch(new RegExp(`^/banco\\?disciplina=${DISC}&p=2&ok=`))
    expect(decodeURIComponent(h.redirects[0])).toContain('Assunto salvo em 2 questões')
  })
  it('um nome escrito vale quando nada da lista foi escolhido', async () => {
    await expect(definirAssuntoEmLote(fd({ sel: Q1, alvo: '', texto: 'Hipertermia maligna', volta: '/banco' }))).rejects.toThrow('REDIRECT')
    expect(updates()[0].dados).toEqual({ topic_id: null, assunto: 'Hipertermia maligna' })
  })
  it('sem escolha ou sem marcar: avisa; "volta" de fora do banco é ignorada', async () => {
    await expect(definirAssuntoEmLote(fd({ sel: Q1, alvo: '', volta: 'https://outro.site' }))).rejects.toThrow('REDIRECT')
    expect(h.redirects[0]).toMatch(/^\/banco\/questoes\?erro=/)
    await expect(definirAssuntoEmLote(fd({ alvo: 'nenhum', volta: '/banco' }))).rejects.toThrow('REDIRECT')
    expect(decodeURIComponent(h.redirects[1])).toContain('Nenhuma questão escolhida')
    expect(updates()).toEqual([])
  })
})

describe('sugerir pelo texto', () => {
  it('liga as questões sem assunto cujo texto tem o nome do assunto (da mesma disciplina)', async () => {
    const OUTRA = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
    h.dados.banco_questoes = [
      { id: Q1, discipline_id: DISC, blocos: [{ tipo: 'texto', texto: 'Paciente com intoxicação por anestésico local após bloqueio' }], alternativas: [] },
      { id: Q2, discipline_id: DISC, blocos: [{ tipo: 'texto', texto: 'Sobre a fisiologia renal' }], alternativas: [] }]
    h.dados.topics = [{ id: TOP, nome: 'Anestésicos locais', discipline_id: DISC }, { id: 'x', nome: 'Fisiologia renal', discipline_id: OUTRA }]
    h.dados['topics:um'] = { id: TOP, nome: 'Anestésicos locais', discipline_id: DISC }
    await expect(sugerirAssuntosDoBanco(fd({ volta: '/banco' }))).rejects.toThrow('REDIRECT')
    expect(updates()).toHaveLength(1); expect(updates()[0].filtros).toEqual([`in(id,${Q1})`])
    expect(decodeURIComponent(h.redirects[0])).toContain('Assunto encontrado para 1 questão')
  })
})

describe('telas', () => {
  const assuntos = [{ id: TOP, nome: 'Anestésicos locais', discipline_id: DISC }, { id: 'c1', nome: 'Arritmias', discipline_id: 'cardio' }]
  const disciplinas = [{ id: 'cardio', nome: 'Cardiologia' }, { id: DISC, nome: 'Anestesiologia' }]
  it('o seletor mostra os assuntos da disciplina da questão primeiro, "Sem assunto" e "Outro"', () => {
    const html = renderToStaticMarkup(<AssuntoDaQuestao id={Q1} topicId={null} assunto={null} disciplinaId={DISC} assuntos={assuntos} disciplinas={disciplinas} />)
    expect(html.indexOf('label="Anestesiologia"')).toBeLessThan(html.indexOf('label="Cardiologia"'))
    expect(html).toContain('Sem assunto'); expect(html).toContain('Outro (escrever)')
  })
  it('um rótulo antigo (sem ligação) continua aparecendo como escolhido', () => {
    const html = renderToStaticMarkup(<AssuntoDaQuestao id={Q1} topicId={null} assunto="Bloqueios" disciplinaId={null} assuntos={[]} disciplinas={[]} />)
    expect(html).toMatch(/<option value="rotulo" selected="">Bloqueios \(só nome\)<\/option>/)
  })
  it('lista do banco: caixinha em cada questão, seletor de assunto e "Sugerir pelo texto"', async () => {
    h.dados.banco_questoes = [{ id: Q1, blocos: [{ tipo: 'texto', texto: 'Enunciado' }], alternativas: [{ letra: 'A', texto: 'a' }], gabarito: 'A', anulada: false,
      discipline_id: DISC, topic_id: null, assunto: null, vezes: 0, acertos: 0, ultimo_certo: null }]
    h.dados.disciplines = [{ id: DISC, nome: 'Anestesiologia' }]
    h.dados.topics = [{ id: TOP, nome: 'Anestésicos locais', discipline_id: DISC }]
    const html = renderToStaticMarkup(await Banco({ searchParams: Promise.resolve({ ok: 'Assunto salvo em 1 questão.' }) }))
    expect(html).toMatch(new RegExp(`<input type="checkbox" form="lote"[^>]*name="sel" value="${Q1}"`))
    expect(html).toContain('name="volta" value="/banco/questoes"')
    expect(html).toContain('id="lote"'); expect(html).toContain('Sugerir pelo texto'); expect(html).toContain('1 questão sem assunto')
    expect(html).toContain('Assunto da questão')
  })
  it('filtro "Sem assunto": pega só as questões sem assunto', async () => {
    await Banco({ searchParams: Promise.resolve({ assunto: '(sem assunto)' }) })
    expect(h.filtros).toContain('banco_questoes.is(assunto,null)'); expect(h.filtros.some(x => x.startsWith('banco_questoes.eq(assunto'))).toBe(false)
  })
  it('Praticar: só o começo do estudo, com o link para organizar no Banco (sem a lista de questões)', async () => {
    h.dados.banco_questoes = [{ discipline_id: DISC, assunto: null, banca: null, vezes: 0, acertos: 0, gabarito: 'A', anulada: false }]
    h.dados.disciplines = [{ id: DISC, nome: 'Anestesiologia' }]
    const html = renderToStaticMarkup(await PraticarInicio({ searchParams: Promise.resolve({}) }))
    expect(html).toContain('O que você quer praticar?'); expect(html).toContain('formAction="/banco/praticar"')
    expect(html).toContain('href="/banco/questoes?assunto=(sem%20assunto)"'); expect(html).toContain('1 questão está sem assunto')
    expect(html).not.toContain('name="sel"'); expect(html).not.toContain('Sugerir pelo texto')
  })
  it('Praticar com o banco vazio: leva a importar', async () => {
    const html = renderToStaticMarkup(await PraticarInicio({ searchParams: Promise.resolve({}) }))
    expect(html).toContain('href="/banco/importar"'); expect(html).not.toContain('O que você quer praticar?')
  })
})
