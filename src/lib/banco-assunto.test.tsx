import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

type Op = { t: string; tipo: string; dados?: any; filtros: string[] }
const h = vi.hoisted(() => ({ dados: {} as Record<string, any>, ops: [] as Op[], redirects: [] as string[], filtros: [] as string[], admin: true }))
const cadeia = (t: string) => {
  const op: Op = { t, tipo: 'select', filtros: [] }
  const r: any = {}
  for (const m of ['select', 'order', 'limit', 'range', 'not', 'neq', 'or']) r[m] = () => r
  for (const m of ['eq', 'in', 'is', 'gte', 'lte']) r[m] = (...a: any[]) => { op.filtros.push(`${m}(${a.map(x => (Array.isArray(x) ? x.join('|') : String(x))).join(',')})`); h.filtros.push(`${t}.${op.filtros.at(-1)}`); return r }
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
  rpc: async (nome: string) => ({ data: nome === 'eh_admin' ? h.admin : null, error: null }), storage: { from: () => ({ createSignedUrls: async () => ({ data: [] }) }) },
}) }))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({ redirect: (u: string) => { h.redirects.push(u); throw new Error('REDIRECT') }, useRouter: () => ({ refresh: () => {}, push: () => {} }) }))

import { definirAssuntoDoBanco, definirAssuntoEmLote, sugerirAssuntosDoBanco, ligarAssunto, importarNoBanco, salvarExplicacao, reportarExplicacao, adicionarTemas, definirTemaEmLote, sugerirTemasPeloTexto, editarTema } from './banco'
import OpcoesDeAssunto from '@/components/banco/OpcoesDeAssunto'
import ExplicacaoDaQuestao from '@/components/banco/ExplicacaoDaQuestao'
import { GET as exportar } from '@/app/(app)/banco/exportar/route'
import AssuntoDaQuestao from '@/components/banco/AssuntoDaQuestao'
import MarcarTodas from '@/components/banco/MarcarTodas'
import Banco from '@/app/(app)/banco/questoes/page'
import PraticarInicio from '@/app/(app)/banco/page'

const Q1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', Q2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const DISC = 'dddddddd-dddd-dddd-dddd-dddddddddddd', TOP = 'tttttttt-tttt-tttt-tttt-tttttttttttt'.replace(/t/g, 'e')
const fd = (o: Record<string, string | string[]>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) for (const x of [v].flat()) f.append(k, x); return f }
const updates = () => h.ops.filter(o => o.t === 'banco_questoes' && o.tipo === 'update')
beforeEach(() => { h.dados = {}; h.ops = []; h.redirects = []; h.filtros = []; h.admin = true })

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
  it('"todas destes filtros": grava em todas as questões dos filtros, não só nas 30 da página', async () => {
    h.dados.banco_questoes = Array.from({ length: 120 }, (_, i) => ({ id: `${String(i).padStart(8, '0')}-aaaa-aaaa-aaaa-aaaaaaaaaaaa` }))
    h.dados['topics:um'] = { id: TOP, nome: 'Via aérea', discipline_id: DISC }
    await expect(definirAssuntoEmLote(fd({ todas: '1', filtros: 'assunto=Anestesiologia', sel: Q1, alvo: `t:${TOP}`, volta: '/banco/questoes?org=1' }))).rejects.toThrow('REDIRECT')
    expect(h.filtros).toContain('banco_questoes.eq(assunto,Anestesiologia)')
    expect(updates()[0].filtros[0].split('|')).toHaveLength(120)
    expect(decodeURIComponent(h.redirects[0])).toContain('Assunto salvo em 120 questões')
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

describe('ligar assuntos', () => {
  it('liga todas as questões com o nome (ainda sem ligação) ao assunto de Matérias escolhido', async () => {
    h.dados.banco_questoes = [{ id: Q1 }, { id: Q2 }]
    h.dados['topics:um'] = { id: TOP, nome: 'Via aérea difícil', discipline_id: DISC }
    await expect(ligarAssunto(fd({ rotulo: 'Via aérea', alvo: `t:${TOP}`, volta: '/banco/questoes' }))).rejects.toThrow('REDIRECT')
    expect(h.filtros).toEqual(expect.arrayContaining(['banco_questoes.eq(assunto,Via aérea)', 'banco_questoes.is(topic_id,null)']))
    expect(updates()[0].dados).toEqual({ topic_id: TOP, assunto: 'Via aérea difícil', discipline_id: DISC })
    expect(updates()[0].filtros).toEqual([`in(id,${Q1}|${Q2})`])
    expect(decodeURIComponent(h.redirects[0])).toContain('2 questões de "Via aérea" ligadas')
  })
  it('"criar em Matérias": cria o assunto com esse nome na disciplina e liga', async () => {
    h.dados.banco_questoes = [{ id: Q1 }]
    h.dados['topics:um'] = { id: '99999999-9999-9999-9999-999999999999', nome: 'Via aérea', discipline_id: DISC }
    await expect(ligarAssunto(fd({ rotulo: 'Via aérea', alvo: `criar:${DISC}` }))).rejects.toThrow('REDIRECT')
    expect(h.ops.find(o => o.tipo === 'insert')!.dados).toMatchObject({ discipline_id: DISC, nome: 'Via aérea' })
  })
  it('sem escolha: avisa e não grava', async () => {
    await expect(ligarAssunto(fd({ rotulo: 'Via aérea', alvo: '' }))).rejects.toThrow('REDIRECT')
    expect(decodeURIComponent(h.redirects[0])).toContain('Escolha o assunto'); expect(updates()).toEqual([])
  })
  it('a tela lista os nomes soltos com o assunto mais parecido já escolhido', async () => {
    h.dados.banco_questoes = [
      { id: Q1, blocos: [], alternativas: [], discipline_id: DISC, topic_id: null, assunto: 'Via aerea', vezes: 0, acertos: 0 },
      { id: Q2, blocos: [], alternativas: [], discipline_id: DISC, topic_id: null, assunto: 'Via aerea', vezes: 0, acertos: 0 }]
    h.dados.disciplines = [{ id: DISC, nome: 'Anestesiologia' }]
    h.dados.topics = [{ id: TOP, nome: 'Via aérea difícil', discipline_id: DISC }]
    const html = renderToStaticMarkup(await Banco({ searchParams: Promise.resolve({ org: '1' }) }))
    expect(html).toContain('Ligar assuntos'); expect(html).toMatch(/<b class="font-medium">Via aerea<\/b> <span class="text-muted">· (<!-- -->)?2(<!-- -->)? (<!-- -->)?questões/)
    expect(html).toContain(`<option value="t:${TOP}" selected="">Via aérea difícil</option>`)
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
    const html = renderToStaticMarkup(<AssuntoDaQuestao id={Q1} topicId={null} assunto={null} disciplinaId={DISC} assuntos={assuntos} disciplinas={disciplinas} abertoInicial />)
    expect(html.indexOf('label="Anestesiologia"')).toBeLessThan(html.indexOf('label="Cardiologia"'))
    expect(html).toContain('Sem assunto'); expect(html).toContain('Outro (escrever)')
  })
  it('fechado (padrão): só o assunto atual e "Mudar assunto"', () => {
    const html = renderToStaticMarkup(<AssuntoDaQuestao id={Q1} topicId={null} assunto="Bloqueios" disciplinaId={null} assuntos={assuntos} disciplinas={disciplinas} />)
    expect(html).toContain('Bloqueios'); expect(html).toContain('só nome, fora de Matérias'); expect(html).toContain('Mudar assunto'); expect(html).not.toContain('<select')
  })
  it('um rótulo antigo (sem ligação) continua aparecendo como escolhido', () => {
    const html = renderToStaticMarkup(<AssuntoDaQuestao id={Q1} topicId={null} assunto="Bloqueios" disciplinaId={null} assuntos={[]} disciplinas={[]} abertoInicial />)
    expect(html).toMatch(/<option value="rotulo" selected="">Bloqueios \(só nome\)<\/option>/)
  })
  it('lista do banco: caixinha em cada questão, seletor de assunto e "Sugerir pelo texto"', async () => {
    h.dados.banco_questoes = [{ id: Q1, blocos: [{ tipo: 'texto', texto: 'Enunciado' }], alternativas: [{ letra: 'A', texto: 'a' }], gabarito: 'A', anulada: false,
      discipline_id: DISC, topic_id: null, assunto: null, vezes: 0, acertos: 0, ultimo_certo: null }]
    h.dados.disciplines = [{ id: DISC, nome: 'Anestesiologia' }]
    h.dados.topics = [{ id: TOP, nome: 'Anestésicos locais', discipline_id: DISC }]
    const html = renderToStaticMarkup(await Banco({ searchParams: Promise.resolve({ ok: 'Assunto salvo em 1 questão.', org: '1' }) }))
    expect(html).toMatch(new RegExp(`<input type="checkbox" form="lote"[^>]*name="sel" value="${Q1}"`))
    expect(html).toContain('name="volta" value="/banco/questoes?org=1"')
    expect(html).toContain('id="lote"'); expect(html).toContain('pelo texto'); expect(html).toContain('1 questão sem assunto')
    expect(html).toContain('Mudar assunto')
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
    expect(html).toContain('href="/banco/questoes?assunto=(sem%20assunto)&amp;org=1"'); expect(html).toContain('1 questão está sem assunto')
    expect(html).not.toContain('name="sel"'); expect(html).not.toContain('Sugerir pelo texto')
  })
  it('Praticar com o banco vazio: leva a importar', async () => {
    const html = renderToStaticMarkup(await PraticarInicio({ searchParams: Promise.resolve({}) }))
    expect(html).toContain('href="/banco/importar"'); expect(html).not.toContain('O que você quer praticar?')
  })
  it('busca simples: banca, assunto e ano à vista; sem "Organizar", nada de caixinhas nem ferramentas', async () => {
    h.dados.banco_questoes = [{ id: Q1, blocos: [{ tipo: 'texto', texto: 'Enunciado' }], alternativas: [], gabarito: 'A', anulada: false, discipline_id: DISC, topic_id: null,
      assunto: 'Via aérea', banca: 'UFMA', ano: 2022, vezes: 0, acertos: 0 }, { id: Q2, blocos: [], alternativas: [], banca: 'UFMA', ano: 2019, assunto: null, vezes: 0, acertos: 0 }]
    const html = renderToStaticMarkup(await Banco({ searchParams: Promise.resolve({ banca: 'UFMA', de: '2020', ate: '2024' }) }))
    expect(h.filtros).toEqual(expect.arrayContaining(['banco_questoes.eq(banca,UFMA)', 'banco_questoes.gte(ano,2020)', 'banco_questoes.lte(ano,2024)']))
    expect(html).toContain('<option value="UFMA" selected="">UFMA (2)</option>'); expect(html).toContain('<option value="2022">2022</option>')
    expect(html).toContain('href="/banco/praticar?banca=UFMA&amp;de=2020&amp;ate=2024"')
    expect(html).not.toContain('name="sel"'); expect(html).not.toContain('Ligar assuntos'); expect(html).not.toContain('Sugerir pelo texto')
    expect(html).toContain('href="/banco/questoes?banca=UFMA&amp;de=2020&amp;ate=2024&amp;org=1"')
  })
})

describe('estudante (conta que não é a administradora)', () => {
  beforeEach(() => { h.admin = false })
  it('não muda assunto, não liga nem sugere: o servidor recusa', async () => {
    expect(await definirAssuntoDoBanco([Q1], { assunto: 'x' })).toEqual({ ok: false, erro: expect.stringContaining('Só a conta administradora') })
    await expect(ligarAssunto(fd({ rotulo: 'Via aérea', alvo: `t:${TOP}` }))).rejects.toThrow('REDIRECT')
    await expect(sugerirAssuntosDoBanco(fd({}))).rejects.toThrow('REDIRECT')
    expect(h.redirects.every(r => decodeURIComponent(r).includes('Só a conta administradora'))).toBe(true)
    expect(h.ops.filter(o => o.tipo !== 'select')).toEqual([])
  })
  it('a tela fica só com a busca: sem Importar, sem Organizar (nem pela URL) e sem "Mudar assunto"; excluir continua', async () => {
    h.dados.banco_questoes = [{ id: Q1, blocos: [{ tipo: 'texto', texto: 'Enunciado' }], alternativas: [], gabarito: 'A', anulada: false, topic_id: null, assunto: null, vezes: 0, acertos: 0 }]
    const html = renderToStaticMarkup(await Banco({ searchParams: Promise.resolve({ org: '1' }) }))
    expect(html).not.toContain('Importar questões'); expect(html).not.toContain('Organiz'); expect(html).not.toContain('name="sel"')
    expect(html).not.toContain('Mudar assunto'); expect(html).not.toContain('Sugerir pelo texto'); expect(html).toContain('Excluir do banco')
    expect(html).toContain('Praticar esta')
  })
  it('Praticar com o banco vazio: sem botão de importar', async () => {
    const html = renderToStaticMarkup(await PraticarInicio({ searchParams: Promise.resolve({}) }))
    expect(html).not.toContain('/banco/importar'); expect(html).toContain('assim que forem publicadas')
  })
  it('marcar todas: começa só com "desta página" (o "todas destes filtros" aparece depois de marcar a página)', () => {
    const html = renderToStaticMarkup(<MarcarTodas form="lote" total={120} naPagina={30} />)
    expect(html).toContain('Marcar todas desta página'); expect(html).not.toContain('name="todas"')
  })
})

describe('temas (lista geral)', () => {
  const T1 = '7e000000-0000-0000-0000-000000000001', T2 = '7e000000-0000-0000-0000-000000000002'
  const temas = [{ id: T1, area: 'cirurgia', especialidade: 'Anestesiologia', nome: 'Via aérea difícil' }, { id: T2, area: 'cirurgia', especialidade: 'Anestesiologia', nome: 'Anestésicos locais' }]
  it('acrescentar: só os que ainda não existem (sem ligar para acento e maiúscula)', async () => {
    h.dados.temas = [{ especialidade: 'ANESTESIOLOGIA', nome: 'via aerea dificil' }]
    await expect(adicionarTemas(fd({ lista: 'Anestesiologia > Via aérea difícil\nAnestesiologia > Anestésicos locais' }))).rejects.toThrow('REDIRECT')
    expect(h.ops.find(o => o.tipo === 'insert')!.dados).toEqual([{ area: expect.anything(), especialidade: 'Anestesiologia', nome: 'Anestésicos locais', palavras: null }])
    expect(decodeURIComponent(h.redirects[0])).toContain('1 tema novo; 1 já existia')
  })
  it('tema que já existe ganha as palavras-chave novas (sem repetir as que já tinha)', async () => {
    h.dados.temas = [{ id: 'h1', especialidade: 'Anestesiologia', nome: 'Hipertermia maligna', palavras: 'Dantrolene' }]
    await expect(adicionarTemas(fd({ lista: 'Anestesiologia > Hipertermia maligna: dantrolene, rigidez de masseter' }))).rejects.toThrow('REDIRECT')
    expect(h.ops.filter(o => o.tipo === 'insert')).toEqual([])
    expect(h.ops.find(o => o.tipo === 'update' && o.t === 'temas')!.dados).toEqual({ palavras: 'Dantrolene, rigidez de masseter' })
    expect(decodeURIComponent(h.redirects[0])).toContain('1 ganhou palavras-chave novas')
  })
  it('sugerir pelo texto acha pela palavra-chave', async () => {
    h.dados.temas = [{ id: 'hm', area: 'cirurgia', especialidade: 'Anestesiologia', nome: 'Hipertermia maligna', palavras: 'dantrolene' }, { id: 'bnm', area: 'cirurgia', especialidade: 'Anestesiologia', nome: 'Bloqueadores neuromusculares', palavras: 'rocurônio, sugamadex' }]
    h.dados.banco_questoes = [{ id: Q1, assunto: 'Anestesiologia', blocos: [{ tipo: 'texto', texto: 'Reversão do bloqueio com sugamadex após rocurônio' }], alternativas: [] }]
    await expect(sugerirTemasPeloTexto(fd({}))).rejects.toThrow('REDIRECT')
    expect(updates()[0].dados.tema_id).toBe('bnm')
  })
  it('dar o tema às marcadas: etiqueta, nome do assunto e, no seu banco, a disciplina e o assunto de Matérias de mesmo nome', async () => {
    h.dados.temas = temas
    h.dados.disciplines = [{ id: DISC, nome: 'anestesiologia' }]
    h.dados.topics = [{ id: TOP, nome: 'Via aerea dificil', discipline_id: DISC }]
    await expect(definirTemaEmLote(fd({ sel: [Q1, Q2], tema: T1, volta: '/banco/questoes?org=1' }))).rejects.toThrow('REDIRECT')
    expect(updates()[0].dados).toEqual({ tema_id: T1, assunto: 'Via aérea difícil', area: 'cirurgia', discipline_id: DISC, topic_id: TOP })
    expect(decodeURIComponent(h.redirects[0])).toContain('Tema "Via aérea difícil" em 2 questões')
  })
  it('estudante não dá tema', async () => {
    h.admin = false
    await expect(definirTemaEmLote(fd({ sel: Q1, tema: T1 }))).rejects.toThrow('REDIRECT')
    expect(updates()).toEqual([]); expect(decodeURIComponent(h.redirects[0])).toContain('Só a conta administradora')
  })
  it('sugerir pelo texto: prefere os temas da especialidade (pelo assunto atual "Anestesiologia") e só grava quando o nome aparece', async () => {
    h.dados.temas = [...temas, { id: 'x', area: 'clinica', especialidade: 'Cardiologia', nome: 'Anestésicos locais' }]
    h.dados.banco_questoes = [
      { id: Q1, assunto: 'Anestesiologia', blocos: [{ tipo: 'texto', texto: 'Dose máxima dos anestésicos locais com adrenalina' }], alternativas: [] },
      { id: Q2, assunto: 'Anestesiologia', blocos: [{ tipo: 'texto', texto: 'Sobre o jejum pré-operatório' }], alternativas: [] }]
    await expect(sugerirTemasPeloTexto(fd({ volta: '/banco/questoes?org=1' }))).rejects.toThrow('REDIRECT')
    expect(updates()).toHaveLength(1); expect(updates()[0].dados.tema_id).toBe(T2); expect(updates()[0].filtros).toEqual([`in(id,${Q1})`])
    expect(decodeURIComponent(h.redirects[0])).toContain('Tema encontrado para 1 questão; 1 ficou sem tema')
  })
  it('renomear um tema troca o nome do assunto nas suas questões com ele', async () => {
    await expect(editarTema(fd({ id: T1, nome: 'Via aérea', especialidade: 'Anestesiologia', area: 'cirurgia' }))).rejects.toThrow('REDIRECT')
    expect(h.ops.filter(o => o.tipo === 'update').map(o => [o.t, o.dados])).toEqual([['temas', { nome: 'Via aérea', especialidade: 'Anestesiologia', area: 'cirurgia' }], ['banco_questoes', { assunto: 'Via aérea' }]])
  })
  it('filtro de assunto: temas com questões agrupados por especialidade; os nomes sem tema em "Outros assuntos"', () => {
    const html = renderToStaticMarkup(<select><OpcoesDeAssunto temas={temas as any} questoes={[{ tema_id: T1, assunto: 'Via aérea difícil' }, { tema_id: T1, assunto: 'x' }, { tema_id: null, assunto: 'Anestesiologia' }, { tema_id: null, assunto: null }]} /></select>)
    expect(html).toContain(`<optgroup label="Anestesiologia"><option value="tema:${T1}">Via aérea difícil (2)</option></optgroup>`)
    expect(html).not.toContain('Anestésicos locais') // sem questões: não aparece
    expect(html).toContain('<optgroup label="Outros assuntos"><option value="Anestesiologia">Anestesiologia (1)</option></optgroup>')
    expect(html).toContain('Sem assunto (1)')
  })
})

describe('importar pacote classificado (com tema)', () => {
  const q = (t: string, tema?: string) => ({ blocos: [{ tipo: 'texto', texto: t }], alternativas: [{ letra: 'A', texto: 'a' }, { letra: 'B', texto: 'b' }], gabarito: 'A', ...(tema ? { tema } : {}) })
  it('aplica o tema da lista (inclusive nas que já estavam no banco) e cria os que faltam', async () => {
    h.dados.temas = [{ id: 'hm', area: 'cirurgia', especialidade: 'Anestesiologia', nome: 'Hipertermia maligna' }]
    h.dados.banco_questoes = [] // a busca por hash devolve vazio no mock: simula ids com a lista abaixo
    h.dados.banco_questoes = [{ id: Q1, hash: 'x' }]
    const r = await importarNoBanco({ questoes: [q('Um', 'ANESTESIOLOGIA > hipertermia maligna'), q('Dois', 'Anestesiologia > Via aérea difícil')] }, null, { criarTemas: true })
    expect(r.ok).toBe(true)
    const ins = h.ops.find(o => o.t === 'temas' && o.tipo === 'insert')!
    expect(ins.dados).toEqual([{ especialidade: 'Anestesiologia', nome: 'Via aérea difícil', area: expect.anything() }])
    expect(h.filtros.some(f => f.startsWith('banco_questoes.in(hash,'))).toBe(true)
  })
  it('sem "criar": os temas que não estão na lista ficam de fora', async () => {
    h.dados.temas = []
    await importarNoBanco({ questoes: [q('Um', 'Anestesiologia > Nova')] }, null, { criarTemas: false })
    expect(h.ops.some(o => o.t === 'temas' && o.tipo === 'insert')).toBe(false)
  })
  it('estudante: o tema do arquivo é ignorado (e a importação nem acontece)', async () => {
    h.admin = false
    expect(await importarNoBanco({ questoes: [q('Um', 'A > B')] })).toMatchObject({ ok: false })
  })
  it('exportar: pacote .json com as questões dos filtros; estudante não exporta', async () => {
    h.dados.banco_questoes = [{ id: Q1, blocos: [{ tipo: 'texto', texto: 'Enunciado' }], alternativas: [{ letra: 'A', texto: 'a' }, { letra: 'B', texto: 'b' }], gabarito: 'B', anulada: false, banca: 'UFMA', ano: 2020, assunto: 'Anestesiologia', discipline_id: DISC }]
    h.dados.disciplines = [{ id: DISC, nome: 'Anestesiologia' }]
    const res = await exportar(new Request('http://x/banco/exportar?banca=UFMA'))
    expect(res.headers.get('content-disposition')).toContain('attachment')
    const p = await res.json()
    expect(p.formato).toBe('residencia-os/banco'); expect(p.questoes[0]).toMatchObject({ enunciado: ['Enunciado'], alternativas: ['a', 'b'], gabarito: 'B', banca: 'UFMA', disciplina: 'Anestesiologia' })
    expect(h.filtros).toContain('banco_questoes.eq(banca,UFMA)')
    h.admin = false
    expect((await exportar(new Request('http://x/banco/exportar'))).status).toBe(403)
  })
})

describe('explicações (IA ou revisadas)', () => {
  const q = (t: string, ex?: string) => ({ blocos: [{ tipo: 'texto', texto: t }], alternativas: [{ letra: 'A', texto: 'a' }, { letra: 'B', texto: 'b' }], gabarito: 'A', ...(ex ? { explicacao: ex } : {}) })
  it('importar: grava a explicação nas questões do arquivo (marcada como IA)', async () => {
    const { createHash } = await import('crypto'), { textoParaHash } = await import('./engine/banco')
    const item = q('Um', 'A está certa porque X.')
    h.dados.banco_questoes = [{ id: Q1, hash: createHash('sha256').update(textoParaHash(item.blocos as any, item.alternativas as any)).digest('hex') }]
    const r = await importarNoBanco({ questoes: [item] })
    expect(r).toMatchObject({ ok: true })
    expect(updates().map(u => u.dados)).toContainEqual({ explicacao: 'A está certa porque X.', explicacao_origem: 'ia' })
  })
  it('administradora edita (fica "revisada") ou apaga; estudante não edita', async () => {
    expect(await salvarExplicacao(Q1, '  Nova explicação ')).toEqual({ ok: true })
    expect(await salvarExplicacao(Q1, '')).toEqual({ ok: true })
    expect(updates().map(u => u.dados)).toEqual([{ explicacao: 'Nova explicação', explicacao_origem: 'revisada' }, { explicacao: null, explicacao_origem: null }])
    h.admin = false
    expect(await salvarExplicacao(Q1, 'x')).toMatchObject({ ok: false })
  })
  it('estudante reporta erro (vai com a impressão digital da questão)', async () => {
    h.admin = false
    h.dados['banco_questoes:um'] = { hash: 'abc', origem_geral: null }
    expect(await reportarExplicacao(Q1, 'curto')).toEqual({ ok: true })
    expect(h.ops.find(o => o.t === 'explicacao_reportes')!.dados).toEqual({ user_id: '11111111-1111-1111-1111-111111111111', hash: 'abc', geral_id: null, motivo: 'curto' })
    expect(await reportarExplicacao(Q1, ' a ')).toMatchObject({ ok: false })
  })
  it('na tela: etiqueta de IA e "Reportar erro" para quem estuda; "Editar" para a administradora', () => {
    const est = renderToStaticMarkup(<ExplicacaoDaQuestao id={Q1} texto="Porque sim." origem="ia" />)
    expect(est).toContain('Explicação gerada por IA: confira'); expect(est).toContain('Reportar erro'); expect(est).not.toContain('Editar')
    const adm = renderToStaticMarkup(<ExplicacaoDaQuestao id={Q1} texto="Porque sim." origem="revisada" podeEditar />)
    expect(adm).toContain('Explicação (revisada)'); expect(adm).toContain('Editar'); expect(adm).not.toContain('Reportar erro')
    expect(renderToStaticMarkup(<ExplicacaoDaQuestao id={Q1} texto={null} origem={null} />)).toBe('')
  })
})
