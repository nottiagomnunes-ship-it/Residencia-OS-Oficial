import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  redirects: [] as string[], assuntos: 0, disciplinas: [] as { id: string }[],
  importacoes: [] as { texto: string; substituir: boolean }[], planos: 0,
  importOk: true, planoOk: true, inseridas: [] as unknown[],
}))
vi.mock('next/navigation', () => ({ redirect: (u: string) => { h.redirects.push(u); throw new Error('REDIRECT') } }))
vi.mock('@/lib/areas-data', () => ({ atribuirAreasPorNome: async () => {} }))
vi.mock('@/lib/importar', () => ({ importarCronograma: async (texto: string, substituir: boolean) => { h.importacoes.push({ texto, substituir }); return h.importOk ? { ok: true, resumo: 'ok' } : { ok: false, erro: 'x' } } }))
vi.mock('@/lib/schedule', () => ({ planejarCronograma: async () => { h.planos++; return h.planoOk ? { ok: true, msg: 'Cronograma atualizado' } : { ok: false, msg: 'Defina a data da prova para gerar o cronograma.' } } }))
vi.mock('@/lib/supabase/server', () => ({ supabaseServer: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
  from: (t: string) => {
    const q: any = {
      update: () => q, eq: () => q, insert: async (d: unknown) => { h.inseridas.push(d); return { error: null } },
      select: (_c?: string, o?: { count?: string }) => t === 'topics' && o?.count ? Promise.resolve({ count: h.assuntos })
        : t === 'disciplines' ? { order: async () => ({ data: h.disciplinas }), then: (r: (v: unknown) => void) => r({ data: h.disciplinas }) } : q,
      single: async () => ({ data: { nome: 'Ana' } }),
      then: (r: (v: unknown) => void) => r({ error: null }),
    }
    return q
  },
}) }))

import { salvarOnboarding } from './onboarding'
import { CRONOGRAMA_PADRAO, ajustarAoPrazo } from './engine/cronograma-padrao'
import { hojeBR } from './dates'
import { lerComeco } from './engine/comeco'
import { renderToStaticMarkup } from 'react-dom/server'
import Onboarding from '@/app/onboarding/page'

function form(comeco?: string) {
  const fd = new FormData()
  for (const [k, v] of Object.entries({ nome: 'Ana', exam_date: '2027-09-01', horas: '2', questoes: '30' })) fd.set(k, v)
  fd.append('dias', '1'); fd.append('dias', '3')
  if (comeco) fd.set('comeco', comeco)
  return fd
}
const salvar = (fd: FormData) => expect(salvarOnboarding(fd)).rejects.toThrow('REDIRECT')

beforeEach(() => { Object.assign(h, { redirects: [], assuntos: 0, disciplinas: [], importacoes: [], planos: 0, importOk: true, planoOk: true, inseridas: [] }) })

describe('assistente inicial: como começar', () => {
  it('cronograma pronto (o padrão): importa o cronograma do R1TMO substituindo, gera o plano e abre Hoje', async () => {
    await salvar(form('pronto'))
    expect(h.importacoes).toEqual([{ texto: ajustarAoPrazo(CRONOGRAMA_PADRAO, hojeBR(), '2027-09-01'), substituir: true }]) // ajustado à data da prova
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
  it('conta nova recebe as disciplinas padrão antes do cronograma', async () => {
    await salvar(form('vazio')); expect((h.inseridas[0] as { nome: string }[]).map(d => d.nome)).toContain('Clínica Médica')
  })
})

describe('assistente inicial: tela', () => {
  it('conta nova vê as três opções, com o cronograma pronto marcado', async () => {
    const html = renderToStaticMarkup(await Onboarding())
    expect(html).toContain('Como quer começar?'); expect(html).toContain('Cronograma R1TMO (66 semanas)')
    expect(html).toMatch(/checked="" value="pronto"|value="pronto" checked=""/); expect(html).toContain('value="importar"'); expect(html).toContain('value="vazio"')
  })
  it('conta que já tem assuntos não vê a escolha', async () => {
    h.assuntos = 5; h.disciplinas = [{ id: 'd1', nome: 'Cardiologia', peso: 3 } as any]
    expect(renderToStaticMarkup(await Onboarding())).not.toContain('Como quer começar?')
  })
})
