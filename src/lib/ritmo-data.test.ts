import { describe, it, expect, vi } from 'vitest'
vi.mock('./gamificacao-data', () => ({ contarAssuntos: async () => ({ total: 100, concluidos: 40 }) }))
import { carregarRitmo } from './ritmo-data'

// banco de mentira: as 4 consultas a topics saem na ordem em que o carregador as pede
function falso(o: { exam: string | null; recentes: string[]; primeira: string | null; semData: number; comData: number }) {
  let t = 0
  const filtros: string[] = []
  const cadeia = (res: any) => { const c: any = new Proxy({}, { get: (_, k: string) => k === 'then' ? (ok: any) => ok(res) : (...a: any[]) => { filtros.push(`${k}:${a.join(',')}`); return c } }); return c }
  const sb: any = { from: (tabela: string) => {
    if (tabela === 'profiles') return cadeia({ data: { exam_date: o.exam } })
    t++
    return cadeia(t === 1 ? { data: o.recentes.map(d => ({ completed_date: d })) } : t === 2 ? { data: o.primeira ? [{ completed_date: o.primeira }] : [] }
      : t === 3 ? { count: o.semData, data: null } : { count: o.comData, data: null })
  } }
  return { sb, filtros }
}

describe('carregarRitmo', () => {
  it('liga as consultas ao cálculo: prova, contagens, histórico e assuntos com e sem data', async () => {
    const hoje = '2026-10-05'
    const { sb, filtros } = falso({ exam: '2026-12-15', recentes: ['2026-10-04', '2026-10-01', '2026-09-20'], primeira: '2026-08-01', semData: 3, comData: 57 })
    const r = await carregarRitmo(sb, hoje)
    expect(r).toMatchObject({ estado: 'ok', total: 100, concluidos: 40, restantes: 60, prazo: '2026-11-30', semData: 3, comData: 57 })
    expect(r.atual).toBeCloseTo(3 / 4, 5)                                  // 3 assuntos nas últimas 4 semanas
    expect(filtros).toContain('gte:completed_date,2026-09-08')              // a janela de leitura são os últimos 28 dias
  })
  it('sem nenhum assunto concluído ainda, só mostra o necessário', async () => {
    const r = await carregarRitmo(falso({ exam: '2026-12-15', recentes: [], primeira: null, semData: 100, comData: 0 }).sb, '2026-10-05')
    expect(r).toMatchObject({ estado: 'ok', status: 'sem_historico', atual: null })
  })
  it('sem data da prova', async () => {
    expect((await carregarRitmo(falso({ exam: null, recentes: [], primeira: null, semData: 0, comData: 0 }).sb, '2026-10-05')).estado).toBe('sem_prova')
  })
})
