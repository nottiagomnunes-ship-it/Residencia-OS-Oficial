import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const h = vi.hoisted(() => ({ dados: {} as Record<string, any>, erro: null as any, ops: [] as { t: string; op: string; v?: any; filtros: string[] }[], redirects: [] as string[] }))
const cadeia = (t: string) => {
  const o = { t, op: 'select', v: undefined as any, filtros: [] as string[] }
  const r: any = {}
  for (const m of ['select', 'order', 'gte', 'lte']) r[m] = (...a: any[]) => { if (m !== 'select' && m !== 'order') o.filtros.push(`${m}:${a.join('=')}`); return r }
  r.eq = (k: string, v: any) => { o.filtros.push(`eq:${k}=${v}`); return r }
  r.insert = (v: any) => { o.op = 'insert'; o.v = v; h.ops.push(o); return Promise.resolve({ error: h.erro }) }
  r.update = (v: any) => { o.op = 'update'; o.v = v; h.ops.push(o); return r }
  r.delete = () => { o.op = 'delete'; h.ops.push(o); return r }
  r.maybeSingle = async () => ({ data: h.dados[t + ':um'] ?? null, error: null })
  r.single = async () => ({ data: h.dados[t + ':um'] ?? null, error: null })
  r.then = (ok: any) => Promise.resolve({ data: h.dados[t] ?? [], error: h.dados[t + ':erro'] ?? null }).then(ok)
  return r
}
vi.mock('@/lib/supabase/server', () => ({ supabaseServer: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) }, from: (t: string) => cadeia(t) }) }))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({ redirect: (u: string) => { h.redirects.push(u); throw new Error('REDIRECT') } }))
vi.mock('@/lib/dates', () => ({ hojeBR: () => '2026-10-07' }))   // quarta-feira

import { criarNaAgenda, copiarEscalaAnterior, pararDeRepetir, excluirDaAgenda } from './agenda'
import { agendaDosDias } from './agenda-data'
import AgendaForm from '@/components/AgendaForm'

const fd = (o: Record<string, string | string[]>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) for (const x of [v].flat()) f.append(k, x); return f }
const rodar = async (p: Promise<unknown>) => { await expect(p).rejects.toThrow('REDIRECT'); return decodeURIComponent(h.redirects.at(-1)!) }
beforeEach(() => { h.dados = {}; h.erro = null; h.ops = []; h.redirects = [] })

describe('ações da agenda', () => {
  it('adicionar: grava marcado como agenda, com categoria; volta para a semana do dia escolhido', async () => {
    const url = await rodar(criarNaAgenda(fd({ semana: '2026-10-05', titulo: 'Plantão', categoria: 'plantao', tipo: 'pontual', data: '2026-10-14', hora_ini: '19:00', hora_fim: '07:00' })))
    expect(h.ops[0]).toMatchObject({ t: 'commitments', op: 'insert', v: { user_id: 'u1', titulo: 'Plantão', categoria: 'plantao', tipo: 'pontual', data: '2026-10-14', dias: [], agenda: true } })
    expect(url).toBe('/agenda?s=2026-10-12&ok="Plantão" adicionado à agenda.')
  })
  it('adicionar inválido não grava e explica', async () => {
    const url = await rodar(criarNaAgenda(fd({ semana: '2026-10-05', titulo: 'Academia', tipo: 'semanal', hora_ini: '18:00', hora_fim: '19:00' })))
    expect(h.ops).toEqual([]); expect(url).toContain('erro=Marque pelo menos um dia')
  })
  it('banco sem a 0029: diz o que rodar', async () => {
    h.erro = { message: 'column "agenda" of relation "commitments" does not exist' }
    expect(await rodar(criarNaAgenda(fd({ titulo: 'A', tipo: 'semanal', dias: ['1'], hora_ini: '18:00', hora_fim: '19:00' })))).toContain('0029_agenda_pessoal.sql')
  })
  it('copiar a semana anterior: só os de um dia, para a semana certa', async () => {
    h.dados.commitments = [{ titulo: 'Enfermaria', categoria: 'internato', tipo: 'pontual', data: '2026-09-29', hora_ini: '07:00:00', hora_fim: '13:00:00' }]
    const url = await rodar(copiarEscalaAnterior(fd({ semana: '2026-10-07' })))
    const ins = h.ops.find(o => o.op === 'insert')!
    expect(ins.v).toEqual([expect.objectContaining({ data: '2026-10-06', titulo: 'Enfermaria', agenda: true, user_id: 'u1' })])
    expect(url).toContain('/agenda?s=2026-10-05&ok=1 horário copiado')
  })
  it('parar de repetir: termina ontem; se ainda nem começou, apaga', async () => {
    h.dados['commitments:um'] = { valido_de: null }
    await rodar(pararDeRepetir(fd({ id: 'c1' })))
    expect(h.ops.find(o => o.op === 'update')!.v).toEqual({ valido_ate: '2026-10-06' })
    h.ops = []; h.dados['commitments:um'] = { valido_de: '2026-10-20' }
    await rodar(pararDeRepetir(fd({ id: 'c1' })))
    expect(h.ops.map(o => o.op)).toEqual(['delete'])
  })
  it('excluir só mexe em item da agenda (nunca nos horários antigos sem querer)', async () => {
    await rodar(excluirDaAgenda(fd({ id: 'c1' })))
    expect(h.ops[0].filtros).toEqual(['eq:id=c1', 'eq:agenda=true'])
  })
})

describe('junção com o calendário', () => {
  it('blocos por dia (com o plantão da véspera) e o tempo livre pela janela do perfil', async () => {
    h.dados.commitments = [
      { id: 'a', titulo: 'Internato', categoria: 'internato', tipo: 'semanal', dias: [1, 2, 3, 4, 5], data: null, hora_ini: '07:00:00', hora_fim: '13:00:00', valido_de: null, valido_ate: null },
      { id: 'b', titulo: 'Plantão', categoria: 'plantao', tipo: 'pontual', dias: [], data: '2026-10-06', hora_ini: '19:00:00', hora_fim: '07:00:00', valido_de: null, valido_ate: null },
    ]
    h.dados['profiles:um'] = { janela_ini: '06:00:00', janela_fim: '23:00:00', folga_min: 30 }
    const r = await agendaDosDias({ from: (t: string) => cadeia(t) } as any, '2026-10-06', '2026-10-08')
    expect(r.ocupados['2026-10-07'].map(o => `${o.titulo}:${o.ini}-${o.fim}`)).toEqual(['Plantão (continuação):0-420', 'Internato:420-780'])
    expect(r.livres['2026-10-07']).toBe('Livre: 13h30–23h (9h30)')
    expect(r.livres['2026-10-06']).toBe('Livre: 6h–6h30 e 13h30–18h30 (5h30)')   // antes do internato sobra meia hora; antes do plantão, a folga de 30 min
  })
  it('sem a 0029: nada aparece e nada quebra', async () => {
    h.dados['commitments:erro'] = { message: 'column commitments.agenda does not exist' }
    expect(await agendaDosDias({ from: (t: string) => cadeia(t) } as any, '2026-10-06', '2026-10-08')).toEqual({ disponivel: false, ocupados: {}, livres: {}, linhas: [] })
  })
})

describe('formulário', () => {
  it('atalhos, "toda semana" com os dias e o aviso de quem vira a noite só quando precisa', () => {
    const html = renderToStaticMarkup(<AgendaForm semana="2026-10-05" hoje="2026-10-07" />)
    expect(html).toContain('Plantão noturno · 19h–7h'); expect(html).toMatch(/aria-pressed="true"[^>]*>Toda semana/)
    expect((html.match(/name="dias"/g) ?? []).length).toBe(7); expect(html).not.toContain('Termina no dia seguinte')
  })
})
