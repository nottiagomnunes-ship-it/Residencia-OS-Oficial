import { it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({ item: null as any, rpcs: [] as any[], inserts: [] as any[], updates: [] as any[], conteudos: [] as string[] }))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({ redirect: () => { throw new Error('REDIRECT') } }))
vi.mock('@/lib/flow', () => ({ concluirConteudo: async (f: FormData) => { h.conteudos.push(String(f.get('topic_id')) + ':' + f.get('duration_min')) }, concluirRevisao: async () => {} }))
vi.mock('@/lib/supabase/server', () => ({ supabaseServer: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
  rpc: async (nome: string, a: unknown) => { h.rpcs.push({ nome, a }); return { error: null } },
  from: (t: string) => {
    const q: any = {
      select: () => q, eq: () => q, in: () => q, single: async () => ({ data: h.item }),
      insert: async (d: unknown) => { h.inserts.push({ t, d }); return { error: null } },
      update: (d: unknown) => { h.updates.push({ t, d }); return q },
      then: (r: (v: unknown) => void) => r({ error: null }),
    }
    return q
  },
}) }))
import { concluirItem } from './calendar'

const item = (titulo: string) => ({ id: 'i1', titulo, tipo: 'estudo', status: 'agendado', data: '2026-10-08', review_id: null, topic_id: 't1', duracao_min: 30 })
beforeEach(() => { Object.assign(h, { rpcs: [], inserts: [], updates: [], conteudos: [] }) })

it('concluir a parte 1 de 2: conta o tempo e o XP, deixa o assunto em andamento e não o conclui', async () => {
  h.item = item('Pré-eclâmpsia (parte 1 de 2)')
  await concluirItem('i1')
  expect(h.conteudos).toEqual([]) // não chamou "concluir assunto" (as revisões só nascem no fim)
  expect(h.rpcs[0]).toMatchObject({ nome: 'registrar_dia', a: { p_min: 30 } })
  expect(h.inserts).toEqual([{ t: 'study_sessions', d: { user_id: 'u1', topic_id: 't1', duration_min: 30 } }])
  expect(h.updates).toEqual([{ t: 'topics', d: { status: 'em_andamento' } }, { t: 'schedule_items', d: { status: 'concluido' } }])
})
it('concluir a última parte (ou um assunto inteiro) conclui o assunto, com o tempo daquela parte', async () => {
  h.item = item('Pré-eclâmpsia (parte 2 de 2)'); await concluirItem('i1')
  expect(h.conteudos).toEqual(['t1:30'])
  h.item = item('Imunizações'); await concluirItem('i1')
  expect(h.conteudos).toEqual(['t1:30', 't1:30'])
})
