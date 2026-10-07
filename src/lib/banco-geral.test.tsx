import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const h = vi.hoisted(() => ({
  dados: {} as Record<string, any>, rpcs: [] as { nome: string; args: any }[], rpcRes: {} as Record<string, any>, redirects: [] as string[],
  filtros: [] as string[], copias: [] as [string, string][], removidos: [] as string[], falhaCopia: false, apagados: [] as string[], updates: [] as any[],
}))
const cadeia = (t: string) => {
  const r: any = {}
  for (const m of ['select', 'order', 'limit', 'range', 'or', 'lt', 'lte', 'gt', 'gte']) r[m] = () => r
  for (const m of ['eq', 'in', 'is', 'not', 'neq']) r[m] = (...a: any[]) => { h.filtros.push(`${t}.${m}(${a.map(x => (Array.isArray(x) ? x.join('|') : String(x))).join(',')})`); return r }
  r.delete = () => { h.apagados.push(t); return r }
  r.update = (d: any) => { h.updates.push({ t, d }); return r }
  r.maybeSingle = async () => ({ data: h.dados[t + ':um'] ?? null, error: null })
  r.then = (ok: any) => Promise.resolve({ data: h.dados[t] ?? [], count: (h.dados[t] ?? []).length, error: null }).then(ok)
  return r
}
vi.mock('@/lib/supabase/server', () => ({ supabaseServer: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: '11111111-1111-1111-1111-111111111111' } } }) }, from: (t: string) => cadeia(t),
  rpc: async (nome: string, args: any) => { h.rpcs.push({ nome, args }); return h.rpcRes[nome] ?? { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } } },
  storage: { from: () => ({
    copy: async (de: string, para: string) => { if (h.falhaCopia) return { error: { message: 'x' } }; h.copias.push([de, para]); return { error: null } },
    remove: async (ps: string[]) => { h.removidos.push(...ps); return {} }, createSignedUrls: async () => ({ data: [] }),
  }) },
}) }))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({ redirect: (u: string) => { h.redirects.push(u); throw new Error('REDIRECT') }, useRouter: () => ({ refresh: () => {}, push: () => {} }) }))

import { publicarNoBancoGeral, retirarDoBancoGeral, restaurarDoBancoGeral, importarNoBanco } from './banco'
import { avisoDoBancoGeral } from './banco-data'
import Banco from '@/app/(app)/banco/questoes/page'
import AdminQuestoes from '@/app/(app)/admin/questoes/page'
import PraticarInicio from '@/app/(app)/banco/page'

const Q1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', Q2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const fd = (o: Record<string, string | string[]>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) for (const x of [v].flat()) f.append(k, x); return f }
const msg = () => decodeURIComponent(h.redirects.at(-1)!)
beforeEach(() => { Object.assign(h, { dados: {}, rpcs: [], rpcRes: {}, redirects: [], filtros: [], copias: [], removidos: [], falhaCopia: false, apagados: [], updates: [] }) })

describe('publicar no banco geral (administrador)', () => {
  const comFiguras = () => { h.dados.banco_questoes = [
    { id: Q1, gabarito: 'B', anulada: false, comentario: 'do cursinho', blocos: [{ tipo: 'texto', texto: 'Enunciado' }, { tipo: 'imagem', caminho: '1111/banco/fig.png' }, { tipo: 'imagem', caminho: '1111/banco/fig.png' }] },
    { id: Q2, gabarito: null, anulada: false, blocos: [{ tipo: 'imagem', caminho: 'geral/ja.png' }] }] }

  it('copia as figuras para geral/ (uma vez cada), manda só id e blocos (nunca o comentário) e avisa', async () => {
    comFiguras(); h.rpcRes.publicar_no_banco_geral = { data: { novas: 2, atualizadas: 0 }, error: null }
    await expect(publicarNoBancoGeral(fd({ sel: [Q1, Q2], colecao: ' Anestesio ', volta: '/banco/questoes' }))).rejects.toThrow('REDIRECT')
    expect(h.copias).toHaveLength(1); expect(h.copias[0][0]).toBe('1111/banco/fig.png'); expect(h.copias[0][1]).toMatch(/^geral\/[0-9a-f-]{36}\.png$/)
    const { p_itens, p_colecao } = h.rpcs.find(r => r.nome === 'publicar_no_banco_geral')!.args
    expect(p_colecao).toBe('Anestesio')
    expect(p_itens.map((i: any) => Object.keys(i))).toEqual([['id', 'blocos'], ['id', 'blocos']])
    expect(JSON.stringify(p_itens)).not.toContain('cursinho')
    expect(p_itens[0].blocos[1].caminho).toBe(h.copias[0][1]); expect(p_itens[0].blocos[2].caminho).toBe(h.copias[0][1]); expect(p_itens[1].blocos[0].caminho).toBe('geral/ja.png')
    expect(msg()).toMatch(/^\/banco\/questoes\?ok=2 questões publicadas no banco geral\. .*sem os comentários.*1 sem gabarito/)
  })
  it('"todas destes filtros": pega as questões pelos filtros da página', async () => {
    h.dados.banco_questoes = [{ id: Q1, gabarito: 'A', anulada: false, blocos: [] }]
    h.rpcRes.publicar_no_banco_geral = { data: { novas: 0, atualizadas: 1 }, error: null }
    await expect(publicarNoBancoGeral(fd({ todas: '1', filtros: 'banca=UFMA&situacao=nunca', volta: '/banco/questoes?banca=UFMA' }))).rejects.toThrow('REDIRECT')
    expect(h.filtros).toEqual(expect.arrayContaining(['banco_questoes.eq(banca,UFMA)', 'banco_questoes.eq(vezes,0)']))
    expect(msg()).toContain('1 já estava lá e foi atualizada')
  })
  it('se uma figura não copia: nada é publicado e as já copiadas são apagadas', async () => {
    comFiguras(); h.falhaCopia = true
    await expect(publicarNoBancoGeral(fd({ sel: Q1 }))).rejects.toThrow('REDIRECT')
    expect(h.rpcs).toEqual([]); expect(msg()).toContain('Nada foi publicado')
  })
  it('conta que não é administradora: recusa e apaga as figuras copiadas', async () => {
    comFiguras(); h.rpcRes.publicar_no_banco_geral = { data: null, error: { code: 'P0001', message: 'Só a conta administradora publica no banco geral' } }
    await expect(publicarNoBancoGeral(fd({ sel: Q1 }))).rejects.toThrow('REDIRECT')
    expect(msg()).toContain('Só a conta administradora'); expect(h.removidos).toEqual([h.copias[0][1]])
  })
  it('sem a 0037: diz o que rodar; sem marcar nada: pede para marcar', async () => {
    h.dados.banco_questoes = [{ id: Q1, gabarito: 'A', anulada: false, blocos: [] }]
    await expect(publicarNoBancoGeral(fd({ sel: Q1 }))).rejects.toThrow('REDIRECT'); expect(msg()).toContain('0037_banco_geral.sql')
    await expect(publicarNoBancoGeral(fd({}))).rejects.toThrow('REDIRECT'); expect(msg()).toContain('Marque as questões')
  })
})

describe('importar já publicando (administrador)', () => {
  beforeEach(() => { h.rpcRes.eh_admin = { data: true, error: null } }) // só a administradora importa (sem a 0037, ninguém importa)
  const q = (t: string) => ({ blocos: [{ tipo: 'texto', texto: t }], alternativas: [{ letra: 'A', texto: 'a' }, { letra: 'B', texto: 'b' }], gabarito: 'A' })
  it('grava no banco e publica as questões do arquivo (achadas pela impressão digital), com a coleção', async () => {
    h.rpcRes.importar_banco = { data: 2, error: null }
    h.rpcRes.publicar_no_banco_geral = { data: { novas: 2, atualizadas: 0 }, error: null }
    h.dados.banco_questoes = [{ id: Q1, gabarito: 'A', anulada: false, blocos: [] }, { id: Q2, gabarito: 'A', anulada: false, blocos: [] }]
    const r = await importarNoBanco({ questoes: [q('Primeira'), q('Segunda')] }, { colecao: ' Anestesio UFMA ' })
    expect(r).toMatchObject({ ok: true, novas: 2, repetidas: 0, publicacao: expect.stringContaining('2 questões publicadas no banco geral') })
    expect(h.filtros.some(f => f.startsWith('banco_questoes.in(hash,'))).toBe(true)
    expect(h.rpcs.find(x => x.nome === 'publicar_no_banco_geral')!.args).toMatchObject({ p_colecao: 'Anestesio UFMA' })
  })
  it('sem marcar "publicar": só importa', async () => {
    h.rpcRes.importar_banco = { data: 1, error: null }
    expect(await importarNoBanco({ questoes: [q('Uma')] })).toEqual({ ok: true, novas: 1, repetidas: 0 })
    expect(h.rpcs.some(x => x.nome === 'publicar_no_banco_geral')).toBe(false)
  })
  it('se a publicação falha, a importação vale e o aviso diz como publicar depois', async () => {
    h.rpcRes.importar_banco = { data: 1, error: null }
    h.dados.banco_questoes = [{ id: Q1, gabarito: 'A', anulada: false, blocos: [] }]
    const r = await importarNoBanco({ questoes: [q('Uma')] }, { colecao: null })
    expect(r).toMatchObject({ ok: true, novas: 1, erroPublicacao: expect.stringContaining('Banco → Organizar') })
  })
  it('publicar muitas: vai de 1000 em 1000, numa vez só', async () => {
    h.dados.banco_questoes = [{ id: Q1, gabarito: 'A', anulada: false, blocos: [] }]
    h.rpcRes.publicar_no_banco_geral = { data: { novas: 1000, atualizadas: 0 }, error: null }
    const ids = Array.from({ length: 2500 }, (_, i) => `${String(i).padStart(8, '0')}-aaaa-aaaa-aaaa-aaaaaaaaaaaa`)
    await expect(publicarNoBancoGeral(fd({ sel: ids }))).rejects.toThrow('REDIRECT')
    expect(h.rpcs.filter(x => x.nome === 'publicar_no_banco_geral')).toHaveLength(3)
    expect(msg()).toContain('3000 questões publicadas')
  })
})

describe('tirar e trazer de volta', () => {
  it('tirar do banco geral (administrador)', async () => {
    h.rpcRes.retirar_do_banco_geral = { data: { geral: 2, copias: 5 }, error: null }
    await expect(retirarDoBancoGeral(fd({ sel: [Q1, Q2] }))).rejects.toThrow('REDIRECT')
    expect(h.rpcs[0].args).toEqual({ p_ids: [Q1, Q2] }); expect(msg()).toContain('2 questões saíram do banco geral e 5 cópias foram tiradas das outras contas')
  })
  it('tirar, antes da 0038: avisa que as cópias ficaram e o que rodar', async () => {
    h.rpcRes.retirar_do_banco_geral = { data: 1, error: null }
    await expect(retirarDoBancoGeral(fd({ sel: Q1 }))).rejects.toThrow('REDIRECT')
    expect(msg()).toContain('0038_retirar_das_contas.sql')
  })
  it('trazer de volta as que a pessoa excluiu: esquece as excluídas e sincroniza de novo', async () => {
    h.rpcRes.sincronizar_banco_geral = { data: { novas: 3, corrigidas: 0 }, error: null }
    await expect(restaurarDoBancoGeral(fd({ volta: '/banco/questoes' }))).rejects.toThrow('REDIRECT')
    expect(h.apagados).toEqual(['banco_geral_removidas']); expect(h.updates).toEqual([{ t: 'profiles', d: { banco_geral_em: null } }])
    expect(msg()).toContain('3 questões do banco geral voltaram')
  })
})

describe('telas', () => {
  it('aviso depois de sincronizar', () => {
    expect(avisoDoBancoGeral(null)).toBeNull(); expect(avisoDoBancoGeral({ novas: 0, corrigidas: 0 })).toBeNull()
    expect(avisoDoBancoGeral({ novas: 1, corrigidas: 2 })).toBe('1 questão nova do banco geral entrou no seu banco e 2 questões foram corrigidas (gabarito ou enunciado).')
  })
  const banco = () => {
    h.dados.banco_questoes = [{ id: Q1, origem_geral: 'g1', blocos: [{ tipo: 'texto', texto: 'Enunciado' }], alternativas: [], gabarito: 'A', anulada: false, discipline_id: null, topic_id: null, assunto: 'X', vezes: 0, acertos: 0 }]
    h.rpcRes.sincronizar_banco_geral = { data: { novas: 5, corrigidas: 0 }, error: null }
  }
  it('administradora: no Banco vê a mesma tela de busca, com o atalho para a Administração; lá as publicadas têm a marca', async () => {
    banco(); h.rpcRes.eh_admin = { data: true, error: null }
    const html = renderToStaticMarkup(await Banco({ searchParams: Promise.resolve({ org: '1' }) }))
    expect(html).not.toContain('Publicar'); expect(html).toContain('Editar na Administração')
    expect(html).toContain('5 questões novas do banco geral entraram no seu banco.')
    const adm = renderToStaticMarkup(await AdminQuestoes({ searchParams: Promise.resolve({}) }))
    expect(adm).toContain('>publicada<'); expect(adm).not.toContain('O comentário <b>não</b> vai') // ações em lote: só depois de marcar
  })
  it('conta comum: sem o bloco de publicar', async () => {
    banco(); h.rpcRes.eh_admin = { data: false, error: null }
    const html = renderToStaticMarkup(await Banco({ searchParams: Promise.resolve({ org: '1' }) }))
    expect(html).not.toContain('Publicar as marcadas'); expect(html).not.toContain('Organiz')
  })
  it('Praticar sincroniza antes de contar', async () => {
    banco()
    const html = renderToStaticMarkup(await PraticarInicio({ searchParams: Promise.resolve({}) }))
    expect(h.rpcs[0].nome).toBe('sincronizar_banco_geral'); expect(html).toContain('5 questões novas do banco geral')
  })
})
