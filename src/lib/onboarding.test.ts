import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  redirects: [] as string[], assuntos: 0, disciplinas: [] as { id: string }[],
  importacoes: [] as { texto: string; substituir: boolean }[], planos: 0,
  importOk: true, planoOk: true, inseridas: [] as unknown[], perfis: [] as any[], meta: {} as Record<string, unknown>, nomePerfil: 'Ana' as string | null,
}))
vi.mock('next/navigation', () => ({ redirect: (u: string) => { h.redirects.push(u); throw new Error('REDIRECT') } }))
vi.mock('@/lib/areas-data', () => ({ atribuirAreasPorNome: async () => {} }))
vi.mock('@/lib/importar', () => ({ importarCronograma: async (texto: string, substituir: boolean) => { h.importacoes.push({ texto, substituir }); return h.importOk ? { ok: true, resumo: 'ok' } : { ok: false, erro: 'x' } } }))
vi.mock('@/lib/schedule', () => ({ planejarCronograma: async () => { h.planos++; return h.planoOk ? { ok: true, msg: 'Cronograma atualizado' } : { ok: false, msg: 'Defina a data da prova para gerar o cronograma.' } } }))
vi.mock('@/lib/supabase/server', () => ({ supabaseServer: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: 'u1', user_metadata: h.meta } } }) },
  from: (t: string) => {
    const q: any = {
      update: (d: unknown) => { if (t === 'profiles') h.perfis.push(d); return q }, eq: () => q, insert: async (d: unknown) => { h.inseridas.push(d); return { error: null } },
      select: (_c?: string, o?: { count?: string }) => t === 'topics' && o?.count ? Promise.resolve({ count: h.assuntos })
        : t === 'disciplines' ? { order: async () => ({ data: h.disciplinas }), then: (r: (v: unknown) => void) => r({ data: h.disciplinas }) } : q,
      single: async () => ({ data: { nome: h.nomePerfil, exam_date: null } }),
      then: (r: (v: unknown) => void) => r({ error: null }),
    }
    return q
  },
}) }))

import { salvarOnboarding } from './onboarding'
import { CRONOGRAMA_PADRAO } from './engine/cronograma-padrao'
import { hojeBR } from './dates'
import { lerComeco, estimarProva, dataDaProva, nomeInicial } from './engine/comeco'
import { renderToStaticMarkup } from 'react-dom/server'
import Onboarding from '@/app/onboarding/page'

function form(comeco?: string) {
  const fd = new FormData()
  for (const [k, v] of Object.entries({ nome: 'Ana', exam_date: '2027-09-01', horas: '2' })) fd.set(k, v)
  fd.append('dias', '1'); fd.append('dias', '3')
  if (comeco) fd.set('comeco', comeco)
  return fd
}
const salvar = (fd: FormData) => expect(salvarOnboarding(fd)).rejects.toThrow('REDIRECT')

beforeEach(() => { Object.assign(h, { redirects: [], assuntos: 0, disciplinas: [], importacoes: [], planos: 0, importOk: true, planoOk: true, inseridas: [], perfis: [], meta: {}, nomePerfil: 'Ana' }) })

describe('assistente inicial: como começar', () => {
  it('cronograma pronto (o padrão): importa o cronograma do R1TMO substituindo, gera o plano e abre Hoje', async () => {
    await salvar(form('pronto'))
    expect(h.importacoes).toEqual([{ texto: CRONOGRAMA_PADRAO, substituir: true }]) // as 66 semanas originais: quem ajusta ao prazo é o gerador
    expect(h.planos).toBe(1); expect(h.redirects).toEqual(['/inicio'])
  })
  it('sem escolha no formulário vale o cronograma pronto', async () => {
    await salvar(form()); expect(h.importacoes).toHaveLength(1)
    expect(lerComeco('qualquer')).toBe('pronto'); expect(lerComeco(null)).toBe('pronto')
  })
  it('importar o meu: vai para a importação, sem importar nada', async () => {
    await salvar(form('importar')); expect(h.importacoes).toEqual([]); expect(h.planos).toBe(0); expect(h.redirects).toEqual(['/importar'])
  })
  it('começar vazio: abre Hoje sem assuntos', async () => {
    await salvar(form('vazio')); expect(h.importacoes).toEqual([]); expect(h.redirects).toEqual(['/inicio'])
  })
  it('conta que já tem assuntos (refazendo o assistente): nunca mexe no plano, mesmo com "pronto"', async () => {
    h.assuntos = 12; h.disciplinas = [{ id: 'd1' }]
    await salvar(form('pronto')); expect(h.importacoes).toEqual([]); expect(h.planos).toBe(0); expect(h.redirects).toEqual(['/inicio'])
  })
  it('se a importação falhar, leva para a importação com o aviso; se o plano não sair, mostra o motivo no cronograma', async () => {
    h.importOk = false; await salvar(form('pronto'))
    expect(h.redirects[0]).toMatch(/^\/importar\?erro=/); expect(h.planos).toBe(0)
    Object.assign(h, { redirects: [], importOk: true, planoOk: false }); await salvar(form('pronto'))
    expect(h.redirects[0]).toMatch(/^\/cronograma\?msg=Defina/)
  })
  it('conta nova recebe as disciplinas padrão com peso 3 (o assistente não pergunta mais os pesos)', async () => {
    await salvar(form('vazio')); const ins = h.inseridas[0] as { nome: string; peso: number }[]
    expect(ins.map(d => d.nome)).toContain('Clínica Médica'); expect(ins.every(d => d.peso === 3)).toBe(true)
  })
  it('salva o perfil curto: data informada, tempo e dias; sem mexer nas questões por dia', async () => {
    await salvar(form('vazio'))
    expect(h.perfis[0]).toEqual({ nome: 'Ana', exam_date: '2027-09-01', daily_minutes: 120, available_weekdays: [1, 3], onboarded: true })
  })
  it('"ainda não sei" a data: usa a estimativa de daqui a um ano; o cronograma entra sem nada gravado a partir dela', async () => {
    const fd = form('pronto'); fd.set('prova_nao_sei', '1'); await salvar(fd)
    expect(h.perfis[0].exam_date).toBe(estimarProva(hojeBR()))
    expect(h.importacoes[0].texto).toBe(CRONOGRAMA_PADRAO) // trocar a data depois e gerar de novo refaz o ritmo
  })
  it('sem dias marcados ou tempo inválido: valores padrão, para o plano não sair vazio', async () => {
    const fd = form('vazio'); fd.delete('dias'); fd.set('horas', 'abc'); await salvar(fd)
    expect(h.perfis[0]).toMatchObject({ daily_minutes: 120, available_weekdays: [1, 2, 3, 4, 5, 6] })
  })
})

describe('assistente inicial: tela', () => {
  it('conta nova vê as três opções, com o cronograma pronto marcado', async () => {
    const html = renderToStaticMarkup(await Onboarding())
    expect(html).toContain('Como quer começar?'); expect(html).toContain('Cronograma R1TMO (66 semanas)')
    expect(html).toMatch(/checked="" value="pronto"|value="pronto" checked=""/); expect(html).toContain('value="importar"'); expect(html).toContain('value="vazio"')
  })
  it('assistente curto: sem pesos nem questões por dia; nome do Google já preenchido; opção "ainda não sei"', async () => {
    h.nomePerfil = null; h.meta = { full_name: 'Bia Souza' }
    const html = renderToStaticMarkup(await Onboarding())
    expect(html).not.toContain('Peso de cada disciplina'); expect(html).not.toContain('Questões por dia')
    expect(html).toContain('value="Bia Souza"'); expect(html).toContain('Ainda não sei')
  })
  it('conta que já tem assuntos não vê a escolha', async () => {
    h.assuntos = 5; h.disciplinas = [{ id: 'd1', nome: 'Cardiologia', peso: 3 } as any]
    expect(renderToStaticMarkup(await Onboarding())).not.toContain('Como quer começar?')
  })
})

describe('assistente inicial: regras', () => {
  it('estimativa da prova: daqui a um ano, inclusive em 29/02', () => {
    expect(estimarProva('2026-10-08')).toBe('2027-10-08'); expect(estimarProva('2028-02-29')).toBe('2029-02-28')
  })
  it('data da prova: aceita só data válida e futura; senão, estimativa', () => {
    expect(dataDaProva('2027-11-20', false, '2026-10-08')).toEqual({ data: '2027-11-20', estimada: false })
    for (const v of ['', null, '2026-01-01', '2026-10-08', 'ontem', '2027-13-45']) expect(dataDaProva(v, false, '2026-10-08').estimada, String(v)).toBe(true)
    expect(dataDaProva('2027-11-20', true, '2026-10-08')).toEqual({ data: '2027-10-08', estimada: true })
  })
  it('nome: o da conta primeiro; senão, o do Google', () => {
    expect(nomeInicial('Tiago', { full_name: 'Outro' })).toBe('Tiago'); expect(nomeInicial(null, { full_name: ' Bia ' })).toBe('Bia')
    expect(nomeInicial('', { name: 'Caio' })).toBe('Caio'); expect(nomeInicial(null, null)).toBe('')
  })
})
