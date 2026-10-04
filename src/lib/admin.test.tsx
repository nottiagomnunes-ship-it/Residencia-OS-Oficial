import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createHash } from 'crypto'

type Op = { t: string; tipo: string; dados?: any; filtros: string[]; campos?: string }
const h = vi.hoisted(() => ({
  ops: [] as Op[], redirects: [] as string[], rpcs: [] as { nome: string; args: any }[], admin: true,
  /** resposta de uma consulta: (tabela, filtros, campos) → { data, count, error } */
  resp: (() => ({ data: [], count: 0, error: null })) as (t: string, filtros: string[], campos: string) => any,
  um: {} as Record<string, any>, uploads: [] as [string, string, number][], baixados: [] as string[], removidos: [] as string[],
}))
const cadeia = (t: string) => {
  const op: Op = { t, tipo: 'select', filtros: [], campos: '' }
  const r: any = {}
  r.select = (c: string) => { op.campos = c; return r }
  for (const m of ['order', 'limit', 'range', 'or']) r[m] = () => r
  for (const m of ['eq', 'in', 'is', 'not', 'neq', 'gte', 'lte']) r[m] = (...a: any[]) => { op.filtros.push(`${m}(${a.map(x => (Array.isArray(x) ? x.join('|') : String(x))).join(',')})`); return r }
  r.update = (d: any) => { op.tipo = 'update'; op.dados = d; h.ops.push(op); return r }
  r.delete = () => { op.tipo = 'delete'; h.ops.push(op); return r }
  const res = () => (op.tipo !== 'select' ? { data: null, count: 1, error: null } : h.resp(t, op.filtros, op.campos ?? ''))
  r.maybeSingle = async () => ({ data: h.um[`${t}:${op.campos}`] ?? h.um[t] ?? null, error: null })
  r.single = r.maybeSingle
  for (const m of ['gt', 'lt']) r[m] = (...a: any[]) => { op.filtros.push(`${m}(${a.join(',')})`); return r }
  r.then = (ok: any) => Promise.resolve(res()).then(ok)
  return r
}
vi.mock('@/lib/supabase/server', () => ({ supabaseServer: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: '11111111-1111-1111-1111-111111111111' } } }) }, from: (t: string) => cadeia(t),
  rpc: async (nome: string, args: any) => { h.rpcs.push({ nome, args }); return nome === 'eh_admin' ? { data: h.admin, error: null } : nome === 'publicar_no_banco_geral' ? { data: { novas: 0, atualizadas: 1 }, error: null } : { data: null, error: null } },
  storage: { from: () => ({ createSignedUrls: async (ps: string[]) => ({ data: ps.map(p => ({ path: p, signedUrl: `https://x/${p}` })) }), copy: async () => ({ error: null }), remove: async (ps: string[]) => { h.removidos.push(...ps); return {} },
    download: async (p: string) => { h.baixados.push(p); return { data: new Blob([readFileSync('src/lib/__fixtures__/prova-com-figuras.pdf')]), error: null } },
    upload: async (p: string, b: Buffer, o: any) => { h.uploads.push([p, o.contentType, b.length]); return { error: null } } }) },
}) }))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({ redirect: (u: string) => { h.redirects.push(u); throw new Error('REDIRECT') }, useRouter: () => ({ refresh: () => {}, push: () => {} }) }))

import { salvarQuestao, excluirQuestaoDaAdmin, importarNoBanco, lerPdfDeQuestoes } from './banco'
import { readFileSync } from 'fs'
import { MARCA_FIGURA } from './engine/provas-pdf'
import { textoParaHash } from './engine/banco'
import Pendencias from '@/app/(app)/admin/page'
import EditarQuestao from '@/app/(app)/admin/questoes/[id]/page'
import BarraDoLote from '@/components/admin/BarraDoLote'
import Banco from '@/app/(app)/banco/questoes/page'
import Desempenho from '@/app/(app)/desempenho/page'
import Caderno from '@/app/(app)/caderno-de-erros/page'

const Q1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', Q0 = '00000000-aaaa-aaaa-aaaa-aaaaaaaaaaaa', Q2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const fd = (o: Record<string, string | string[]>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) for (const x of [v].flat()) f.append(k, x); return f }
const msg = () => decodeURIComponent(h.redirects.at(-1)!)
const updates = () => h.ops.filter(o => o.t === 'banco_questoes' && o.tipo === 'update')
const QUESTAO = {
  id: Q1, hash: 'h-antigo', blocos: [{ tipo: 'texto', texto: 'Qual a conduta?' }, { tipo: 'imagem', caminho: 'u/fig.png' }],
  alternativas: [{ letra: 'A', texto: 'Intubar' }, { letra: 'B', texto: 'Observar' }], gabarito: 'A', gabarito_origem: 'ia', anulada: false,
  banca: 'UFMA', ano: 2022, tema_id: null, explicacao: 'Porque sim.', explicacao_origem: 'ia', comentario: 'meu', origem_geral: 'g1',
}
const base = { id: Q1, bloco_0: 'Qual a conduta?', alt_letra: ['A', 'B'], alt_texto: ['Intubar', 'Observar'], gabarito: 'A', banca: 'UFMA', ano: '2022', tema: '', explicacao: 'Porque sim.', comentario: 'meu' }
beforeEach(() => { Object.assign(h, { ops: [], redirects: [], rpcs: [], admin: true, um: {}, uploads: [], baixados: [], removidos: [], resp: () => ({ data: [], count: 0, error: null }) }) })

describe('salvar uma questão (Administração)', () => {
  beforeEach(() => { h.um.banco_questoes = QUESTAO })
  it('sem mudar o texto: mantém a impressão digital, a figura e a explicação (continua "IA")', async () => {
    await expect(salvarQuestao(fd({ ...base, banca: 'UFMA ', ano: '2023' }))).rejects.toThrow('REDIRECT')
    const d = updates()[0].dados
    expect(d.blocos).toEqual(QUESTAO.blocos); expect(d.ano).toBe(2023); expect(d.gabarito_origem).toBe('ia')
    expect(d).not.toHaveProperty('explicacao') // não mudou: não vira "revisada"
    expect(d.hash).toBe(createHash('sha256').update(textoParaHash(QUESTAO.blocos as any, QUESTAO.alternativas as any)).digest('hex'))
    expect(msg()).toBe(`/admin/questoes/${Q1}?ok=Salvo. Para chegar às outras contas, use "Salvar e publicar".`)
  })
  it('mudou o enunciado, a alternativa, o gabarito e a explicação: refaz a impressão digital, gabarito oficial, explicação revisada', async () => {
    await expect(salvarQuestao(fd({ ...base, bloco_0: 'Qual a conduta inicial?', alt_texto: ['Intubar', 'Observar e reavaliar'], gabarito: 'B', explicacao: 'Nova.', anulada: '1' }))).rejects.toThrow('REDIRECT')
    const d = updates()[0].dados
    expect(d.blocos[0].texto).toBe('Qual a conduta inicial?'); expect(d.blocos[1]).toEqual({ tipo: 'imagem', caminho: 'u/fig.png' })
    expect(d.alternativas[1].texto).toBe('Observar e reavaliar'); expect(d.gabarito).toBe('B'); expect(d.gabarito_origem).toBe('oficial'); expect(d.anulada).toBe(true)
    expect(d.explicacao).toBe('Nova.'); expect(d.explicacao_origem).toBe('revisada')
    expect(d.hash).toBe(createHash('sha256').update(textoParaHash(d.blocos, d.alternativas)).digest('hex')); expect(d.hash).not.toBe('h-antigo')
    expect(h.ops.find(o => o.t === 'explicacao_reportes')).toMatchObject({ tipo: 'update', dados: { hash: d.hash }, filtros: ['eq(hash,h-antigo)', 'is(resolvido_em,null)'] }) // os reportes seguem a questão
  })
  it('alternativa apagada sai; acrescentar uma letra nova funciona', async () => {
    await expect(salvarQuestao(fd({ ...base, alt_letra: ['A', 'B', 'C'], alt_texto: ['Intubar', '', 'Nova'], gabarito: 'C' }))).rejects.toThrow('REDIRECT')
    expect(updates()[0].dados.alternativas).toEqual([{ letra: 'A', texto: 'Intubar' }, { letra: 'C', texto: 'Nova' }])
  })
  it('recusa (e não grava): texto igual ao de outra questão sua, enunciado vazio, gabarito fora das alternativas, menos de 2 alternativas', async () => {
    h.resp = (t, f) => (t === 'banco_questoes' && f.some(x => x.startsWith('eq(hash')) ? { data: [{ id: Q2 }], error: null } : { data: [], error: null })
    await expect(salvarQuestao(fd({ ...base, bloco_0: 'Outro texto' }))).rejects.toThrow('REDIRECT'); expect(msg()).toContain('igual a outra questão')
    h.resp = () => ({ data: [], error: null })
    await expect(salvarQuestao(fd({ ...base, bloco_0: '  ' }))).rejects.toThrow('REDIRECT'); expect(msg()).toContain('enunciado não pode ficar vazio')
    await expect(salvarQuestao(fd({ ...base, gabarito: 'D' }))).rejects.toThrow('REDIRECT'); expect(msg()).toContain('O gabarito D não é uma das alternativas')
    await expect(salvarQuestao(fd({ ...base, alt_texto: ['Intubar', ''] }))).rejects.toThrow('REDIRECT'); expect(msg()).toContain('pelo menos duas')
    expect(updates()).toEqual([])
  })
  it('"Salvar e publicar": salva e publica (atualiza a cópia do banco geral)', async () => {
    h.resp = (t, f) => (t === 'banco_questoes' && !f.some(x => x.startsWith('eq(hash')) ? { data: [{ id: Q1, blocos: [{ tipo: 'texto', texto: 'x' }], gabarito: 'A', anulada: false }], error: null } : { data: [], error: null })
    await expect(salvarQuestao(fd({ ...base, intencao: 'publicar', volta: `/admin/questoes/${Q1}?lista=%2Fadmin%2Fquestoes%3Fadm%3Dsem-tema` }))).rejects.toThrow('REDIRECT')
    expect(updates()).toHaveLength(1); expect(h.rpcs.find(r => r.nome === 'publicar_no_banco_geral')?.args.p_itens).toEqual([{ id: Q1, blocos: [{ tipo: 'texto', texto: 'x' }] }])
    expect(msg()).toBe(`/admin/questoes/${Q1}?lista=/admin/questoes?adm=sem-tema&ok=Salvo e atualizado no banco geral. As outras contas recebem ao abrir Praticar ou Banco.`)
  })
  it('figuras: tira a marcada, acrescenta a nova no lugar escolhido; caminho de outra conta é ignorado', async () => {
    const U = '11111111-1111-1111-1111-111111111111', nova = `${U}/banco/cccccccc-cccc-cccc-cccc-cccccccccccc.png`
    await expect(salvarQuestao(fd({ ...base, remover_figura: '1', figura_nova: [`-1|${nova}`, `0|outra-conta/banco/cccccccc-cccc-cccc-cccc-cccccccccccc.png`] }))).rejects.toThrow('REDIRECT')
    expect(updates()[0].dados.blocos).toEqual([{ tipo: 'imagem', caminho: nova }, { tipo: 'texto', texto: 'Qual a conduta?' }])
    await expect(salvarQuestao(fd({ ...base, figura_nova: `0|${nova}` }))).rejects.toThrow('REDIRECT')
    expect(updates()[1].dados.blocos.map((b: any) => b.caminho ?? b.texto)).toEqual(['Qual a conduta?', nova, 'u/fig.png'])
  })
  it('estudante não edita; "volta" de fora é ignorada', async () => {
    h.admin = false
    await expect(salvarQuestao(fd({ ...base, volta: 'https://outro.site' }))).rejects.toThrow('REDIRECT')
    expect(msg()).toBe(`/admin/questoes/${Q1}?erro=Só a conta administradora edita as questões aqui.`); expect(updates()).toEqual([])
  })
  it('excluir volta para a lista (com os filtros)', async () => {
    await expect(excluirQuestaoDaAdmin(fd({ id: Q1, lista: '/admin/questoes?adm=sem-tema' }))).rejects.toThrow('REDIRECT')
    expect(h.ops.find(o => o.tipo === 'delete')?.filtros).toEqual([`eq(id,${Q1})`]); expect(msg()).toMatch(/^\/admin\/questoes\?adm=sem-tema&ok=Questão excluída/)
  })
})

describe('telas da Administração', () => {
  it('Pendências: conta o que falta, com atalho para cada filtro, e os reportes abertos com link para corrigir', async () => {
    const n: Record<string, number> = { 'is(tema_id,null)': 4, 'eq(pendente_publicar,true)': 2, 'is(origem_geral,null)': 7 }
    h.resp = (t, f) => t === 'explicacao_reportes' ? { data: [{ id: 'r1', hash: 'hh', motivo: 'Gabarito diz B', criado_em: '2026-10-01T10:00:00Z' }], error: null }
      : t === 'banco_questoes' && f.some(x => x.startsWith('in(hash')) ? { data: [{ id: Q1, hash: 'hh', blocos: [{ tipo: 'texto', texto: 'Enunciado X' }], banca: 'UFMA', ano: 2022 }], error: null }
      : { data: null, count: f.length ? n[f[0]] ?? 0 : 50, error: null }
    const html = renderToStaticMarkup(await Pendencias())
    expect(html).toContain('href="/admin/questoes?adm=sem-tema"'); expect(html).toContain('href="/admin/questoes?adm=falta-publicar"')
    expect(html).toMatch(/Sem tema<\/span><span class="[^"]*text-warn">4</)
    expect(html).toContain('“Gabarito diz B”'); expect(html).toContain(`href="/admin/questoes/${Q1}?lista=%2Fadmin%2Fquestoes%3Fadm%3Dreportadas"`)
    expect(html).not.toContain('Tudo em dia')
  })
  it('Pendências: "Tudo em dia" quando não falta nada (só no seu banco não é pendência)', async () => {
    h.resp = (t, f) => (t === 'explicacao_reportes' ? { data: [], error: null } : { data: null, count: f[0] === 'is(origem_geral,null)' ? 3 : 0, error: null })
    expect(renderToStaticMarkup(await Pendencias())).toContain('Tudo em dia')
  })
  it('Pendências: estudante vai para Praticar', async () => {
    h.admin = false
    await expect(Pendencias()).rejects.toThrow('REDIRECT'); expect(h.redirects).toEqual(['/banco'])
  })
  it('editar: tudo numa página, com o estado, anterior/próxima pelos mesmos filtros e os botões de salvar', async () => {
    h.um.banco_questoes = { ...QUESTAO, vezes: 2, acertos: 1 }
    h.um['banco_questoes:tema_id,explicacao,explicacao_origem,pendente_publicar'] = { tema_id: null, explicacao: 'Porque sim.', explicacao_origem: 'ia', pendente_publicar: true }
    h.resp = (t, f, c) => (t === 'banco_questoes' && c === 'id' ? { data: [{ id: Q0 }, { id: Q1 }, { id: Q2 }], error: null } : { data: [], error: null })
    const lista = '/admin/questoes?banca=UFMA'
    const html = renderToStaticMarkup(await EditarQuestao({ params: Promise.resolve({ id: Q1 }), searchParams: Promise.resolve({ lista }) }))
    expect(html).toContain('Alterada, falta publicar'); expect(html).toMatch(/2(<!-- -->)? de (<!-- -->)?3/)
    expect(html).toContain(`href="/admin/questoes/${Q0}?lista=${encodeURIComponent(lista)}"`); expect(html).toContain(`href="/admin/questoes/${Q2}?lista=${encodeURIComponent(lista)}"`)
    expect(html).toContain('name="bloco_0"'); expect(html).not.toContain('name="bloco_1"'); expect(html).toContain('name="remover_figura" value="1"'); expect(html).toContain('Acrescentar figura')
    expect(html).toContain('Salvar e atualizar no banco geral'); expect(html).toContain('escrita pela IA'); expect(html).toContain('nunca é publicado')
    expect(html).toContain(`name="volta" value="/admin/questoes/${Q1}?lista=${encodeURIComponent(lista)}"`)
  })
  it('ações em lote: escondidas até marcar alguma questão', () => {
    const html = renderToStaticMarkup(<BarraDoLote form="lote"><button>Publicar</button></BarraDoLote>)
    expect(html).toContain('Marque questões na lista'); expect(html).not.toContain('Publicar')
  })
})

describe('importar de novo com figuras', () => {
  it('a questão que já estava no banco SEM figura ganha as figuras do arquivo; a que já tinha figura fica como está', async () => {
    const U = '11111111-1111-1111-1111-111111111111'
    const q = (texto: string) => ({ blocos: [{ tipo: 'texto', texto }, { tipo: 'imagem', caminho: `${U}/banco/fig-${texto}.png` }], alternativas: [{ letra: 'A', texto: 'a' }, { letra: 'B', texto: 'b' }], gabarito: 'A' })
    const hash = (texto: string) => createHash('sha256').update(textoParaHash([{ tipo: 'texto', texto }], [{ letra: 'A', texto: 'a' }, { letra: 'B', texto: 'b' }] as any)).digest('hex')
    h.resp = (t, f, c) => (t === 'banco_questoes' && c === 'id,hash,blocos'
      ? { data: [{ id: Q1, hash: hash('Um'), blocos: [{ tipo: 'texto', texto: 'Um' }] }, { id: Q2, hash: hash('Dois'), blocos: [{ tipo: 'texto', texto: 'Dois' }, { tipo: 'imagem', caminho: 'x.png' }] }], error: null }
      : { data: [], error: null })
    const r = await importarNoBanco({ questoes: [q('Um'), q('Dois')] })
    expect(r).toMatchObject({ ok: true, novas: 0, repetidas: 2, figuras: '1 questão que já estava no banco ganhou a figura.' })
    expect(updates().map(u => [u.filtros, u.dados.blocos[1].caminho])).toEqual([[[`eq(id,${Q1})`], `${U}/banco/fig-Um.png`]])
  })
})

describe('ler o PDF com as figuras', () => {
  it('guarda as figuras na pasta da conta (WebP) e devolve o caminho e o link para a prévia, com o texto marcado', async () => {
    const f = new FormData(); f.set('pdf', new File([readFileSync('src/lib/__fixtures__/prova-com-figuras.pdf')], 'prova.pdf', { type: 'application/pdf' }))
    const r = await lerPdfDeQuestoes(f)
    expect(r.erro).toBeUndefined(); expect(Object.keys(r.figuras!)).toEqual(['pdf-p1-1', 'pdf-p2-2'])
    expect(h.uploads.map(u => [u[0].replace(/\/banco\/[0-9a-f-]{36}/, '/banco/ID'), u[1]])).toEqual([['11111111-1111-1111-1111-111111111111/banco/ID.webp', 'image/webp'], ['11111111-1111-1111-1111-111111111111/banco/ID.webp', 'image/webp']])
    expect(r.figuras!['pdf-p1-1']).toEqual({ caminho: h.uploads[0][0], url: `https://x/${h.uploads[0][0]}` })
    expect(r.paginas![0]).toContain(`Observe o ECG abaixo:\n${MARCA_FIGURA}pdf-p1-1\nQual o diagnóstico?`)
  })
  it('PDF grande: vem pelo armazenamento "importacao" (só da própria pasta), é lido e apagado', async () => {
    const U = '11111111-1111-1111-1111-111111111111', c = `${U}/cccccccc-cccc-cccc-cccc-cccccccccccc.pdf`
    const f = new FormData(); f.set('caminho', c)
    const r = await lerPdfDeQuestoes(f)
    expect(r.erro).toBeUndefined(); expect(r.paginas).toHaveLength(3); expect(h.baixados).toEqual([c]); expect(h.removidos).toContain(c)
    const g = new FormData(); g.set('caminho', `outra-conta/cccccccc-cccc-cccc-cccc-cccccccccccc.pdf`)
    expect(await lerPdfDeQuestoes(g)).toEqual({ erro: 'Arquivo inválido.' }); expect(h.baixados).toHaveLength(1)
  })
})

describe('Banco (tela de busca)', () => {
  it('ao abrir a questão, a figura aparece (link temporário), e o resumo não começa com "[figura]"', async () => {
    h.resp = (t, f, c) => (t === 'banco_questoes' && !c.includes('tema_id') && !c.includes('explicacao')
      ? { data: [{ id: Q1, blocos: [{ tipo: 'imagem', caminho: 'geral/ecg.webp' }, { tipo: 'texto', texto: 'Paciente com palpitações.' }], alternativas: [], gabarito: 'A', anulada: false, assunto: 'X', vezes: 0, acertos: 0 }], count: 1, error: null }
      : { data: [], count: 0, error: null })
    const html = renderToStaticMarkup(await Banco({ searchParams: Promise.resolve({}) }))
    expect(html).toContain('src="https://x/geral/ecg.webp"'); expect(html).toContain('· com figura')
    expect(html).not.toContain('[figura'); expect(html).toContain('<span class="block">Paciente com palpitações.</span>')
  })
})

describe('só a administradora (regra única)', () => {
  it('conta comum ou banco sem a função eh_admin: não lê PDF nem importa', async () => {
    h.admin = false
    const f = new FormData(); f.set('pdf', new File([readFileSync('src/lib/__fixtures__/prova-com-figuras.pdf')], 'p.pdf'))
    expect((await lerPdfDeQuestoes(f)).erro).toMatch(/Só a conta administradora/)
    expect(await importarNoBanco({ questoes: [] })).toMatchObject({ ok: false, erro: expect.stringMatching(/Só a conta administradora/) })
    expect(h.uploads).toEqual([])
  })
})

describe('Desempenho por tema', () => {
  it('mostra o acerto em cada tema das questões do banco, o menor primeiro, com atalho para praticar o tema', async () => {
    const T1 = '7e000000-0000-0000-0000-000000000001', T2 = '7e000000-0000-0000-0000-000000000002'
    h.resp = (t, f, c) => t === 'temas' ? { data: [{ id: T1, area: 'cirurgia', especialidade: 'Anestesiologia', nome: 'Via aérea difícil', palavras: null }, { id: T2, area: 'cirurgia', especialidade: 'Anestesiologia', nome: 'Hipertermia maligna', palavras: null }], error: null }
      : t === 'banco_questoes' && c === 'tema_id,vezes,acertos' ? { data: [{ tema_id: T1, vezes: 10, acertos: 9 }, { tema_id: T2, vezes: 6, acertos: 2 }], error: null }
      : { data: [], error: null }
    const html = renderToStaticMarkup(await Desempenho())
    expect(html).toContain('Banco de questões por tema')
    expect(html.indexOf('Hipertermia maligna')).toBeLessThan(html.indexOf('Via aérea difícil'))
    expect(html).toMatch(/33%.*\(2\/6\)/); expect(html).toContain(`href="/banco/praticar?assunto=${encodeURIComponent(`tema:${T2}`)}"`)
  })
})

describe('Caderno de Erros ligado ao banco', () => {
  const T1 = '7e000000-0000-0000-0000-000000000001', E1 = 'e1000000-0000-0000-0000-000000000001', E2 = 'e2000000-0000-0000-0000-000000000002'
  const montar = () => {
    h.resp = (t, f, c) => {
      if (t === 'error_notebook' && c === 'id,banco_questao_id') return { data: [{ id: E1, banco_questao_id: Q1 }], error: null }
      if (t === 'error_notebook') return { data: [{ id: E1, motivo: 'falta_conteudo', enunciado: 'UFMA 2024 · ECG com QRS largo', revisado: false, revisar_em: null },
        { id: E2, motivo: 'falta_atencao', enunciado: 'Anotado à mão', revisado: false, revisar_em: '2026-12-01', disciplines: { nome: 'Pediatria' } }], error: null }
      if (t === 'temas') return { data: [{ id: T1, area: 'clinica', especialidade: 'Cardiologia', nome: 'Taquicardia ventricular', palavras: null }], error: null }
      if (t === 'banco_questoes') return { data: [{ id: Q1, blocos: [{ tipo: 'imagem', caminho: 'geral/ecg.webp' }, { tipo: 'texto', texto: 'ECG' }], tema_id: T1 }], error: null }
      if (t === 'revisao_questoes' && c === 'questao_id,etapa,proxima') return { data: [{ questao_id: Q1, etapa: 1, proxima: '2099-01-10' }], error: null }
      if (t === 'revisao_questoes') return { data: null, count: 2, error: null }
      return { data: [], error: null }
    }
  }
  it('erro do banco: tema, figura, onde está na fila e "Refazer esta questão"; bloco "Refazer as erradas" no topo', async () => {
    montar()
    const html = renderToStaticMarkup(await Caderno({ searchParams: Promise.resolve({}) }))
    expect(html).toContain('Taquicardia ventricular'); expect(html).toContain('src="https://x/geral/ecg.webp"')
    expect(html).toContain('Volta para refazer em 10/01'); expect(html).toContain(`href="/banco/praticar?questao=${Q1}"`)
    expect(html).toContain('Refazer as erradas'); expect(html).toContain('Refazer agora (')
    expect(html).toContain('Anotado à mão'); expect(html).toContain('Revisar em 01/12') // o anotado à mão continua igual
  })
  it('filtrar por tema mostra só os erros das questões daquele tema', async () => {
    montar()
    const html = renderToStaticMarkup(await Caderno({ searchParams: Promise.resolve({ t: T1 }) }))
    expect(html).toContain('UFMA 2024 · ECG com QRS largo'); expect(html).not.toContain('Anotado à mão')
    expect(html).toContain(`<option value="${T1}" selected="">Taquicardia ventricular · Cardiologia (1)</option>`)
  })
})
