import { describe, it, expect } from 'vitest'
import { etapasDasRevisoes } from './revisao-etapas-data'

// banco de mentira: cada tabela devolve o resultado combinado, e cada rpc/consulta é registrada
function falso(cfg: { reviews: { data?: any[]; error?: any }; tasks?: any[]; rpc?: { data?: any; error?: any } }) {
  const chamadas: string[] = []
  const cadeia = (res: any) => { const c: any = { select: () => c, in: () => c, order: () => c, then: (ok: any) => ok(res) }; return c }
  const sb: any = {
    from: (t: string) => { chamadas.push('from:' + t); return cadeia(t === 'reviews' ? { data: cfg.reviews.data ?? null, error: cfg.reviews.error ?? null } : { data: cfg.tasks ?? [], error: null }) },
    rpc: (n: string, a: any) => { chamadas.push(`rpc:${n}:${a.p_ids.join('+')}`); return Promise.resolve({ data: cfg.rpc?.data ?? [], error: cfg.rpc?.error ?? null }) },
  }
  return { sb, chamadas }
}
const t = (id: string, review_id: string, titulo = 'x') => ({ id, review_id, tipo: 'leitura', titulo, qtd_questoes: null, concluida: false })

describe('etapasDasRevisoes', () => {
  it('não chama o banco sem revisões', async () => {
    const { sb, chamadas } = falso({ reviews: { data: [] } })
    expect(await etapasDasRevisoes(sb, [])).toEqual({}); expect(chamadas).toEqual([])
  })
  it('semeia só as revisões que ainda não receberam o padrão e devolve os itens de cada uma', async () => {
    const { sb, chamadas } = falso({ reviews: { data: [{ id: 'A', etapas_semeadas: true }, { id: 'B', etapas_semeadas: false }] }, rpc: { data: ['B'] }, tasks: [t('1', 'A'), t('2', 'B'), t('3', 'B')] })
    const r = await etapasDasRevisoes(sb, ['A', 'B'])
    expect(chamadas).toContain('rpc:semear_revisoes:B')            // só a B foi semeada
    expect(chamadas.filter(c => c.startsWith('rpc')).length).toBe(1)
    expect(r.A.map(e => e.id)).toEqual(['1']); expect(r.B.map(e => e.id)).toEqual(['2', '3'])
  })
  it('revisão já semeada sem itens (apagados de propósito) aparece com lista vazia, e a não semeada pendente-concluída fica de fora', async () => {
    const { sb } = falso({ reviews: { data: [{ id: 'A', etapas_semeadas: true }, { id: 'C', etapas_semeadas: false }] }, rpc: { data: [] }, tasks: [] })
    const r = await etapasDasRevisoes(sb, ['A', 'C'])
    expect(r.A).toEqual([]); expect('C' in r).toBe(false)           // C é concluída: o banco não a semeou
  })
  it('migração 0020 ainda não aplicada: devolve vazio, sem derrubar a página', async () => {
    expect(await etapasDasRevisoes(falso({ reviews: { error: { code: '42703' } } }).sb, ['A'])).toEqual({})
    expect(await etapasDasRevisoes(falso({ reviews: { data: [{ id: 'A', etapas_semeadas: false }] }, rpc: { error: { code: '42883' } } }).sb, ['A'])).toEqual({})
  })
  it('repete o id sem duplicar e divide em lotes de 80', async () => {
    const ids = Array.from({ length: 170 }, (_, i) => 'r' + i)
    const { sb, chamadas } = falso({ reviews: { data: [] } })
    await etapasDasRevisoes(sb, [...ids, ...ids])
    expect(chamadas.filter(c => c === 'from:reviews').length).toBe(3)   // 80 + 80 + 10
  })
})
