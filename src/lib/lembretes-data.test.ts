import { describe, it, expect } from 'vitest'
import { carregarLembrete } from './lembretes-data'

// banco de mentira: devolve o combinado por tabela e registra os filtros de cada consulta
function falso(o: { perfil?: any; itens?: any[]; cap?: any; erros?: number }) {
  const filtros: Record<string, string[]> = {}
  const cadeia = (tabela: string, res: any) => { const c: any = new Proxy({}, { get: (_, k: string) => k === 'then' ? (ok: any) => ok(res) : (...a: any[]) => { (filtros[tabela] ??= []).push(`${k}:${a.join(',')}`); return c } }); return c }
  const sb: any = { from: (t: string) => cadeia(t, t === 'profiles' ? { data: o.perfil ?? null } : t === 'schedule_items' ? { data: o.itens ?? [] } : t === 'capacidade_dia' ? { data: o.cap ?? null } : { count: o.erros ?? 0 }) }
  return { sb, filtros }
}
const hoje = '2026-10-05' // segunda

describe('carregarLembrete', () => {
  it('usa o tempo informado para hoje, a ordem do plano e separa o que cabe', async () => {
    const { sb } = falso({ perfil: { nome: 'Ana Maria', daily_minutes: 240, available_weekdays: [1, 2, 3, 4, 5] }, cap: { minutos: 90 }, erros: 2,
      itens: [{ titulo: 'Atrasada', tipo: 'estudo', data: '2026-10-02', duracao_min: 60 }, { titulo: 'De hoje', tipo: 'estudo', data: hoje, duracao_min: 60 }] })
    const d = await carregarLembrete(sb, 'u1', hoje)
    expect(d).toMatchObject({ nome: 'Ana Maria', minutos: 90, informado: true, erros: 2, atrasadas: 1, usado: 60 })
    expect(d.cabem.map(t => t.titulo)).toEqual(['Atrasada']); expect(d.depois.map(t => t.titulo)).toEqual(['De hoje'])
  })
  it('sem tempo informado usa o padrão nos dias de estudo e zero nos demais', async () => {
    const perfil = { nome: null, daily_minutes: 150, available_weekdays: [1, 2, 3, 4, 5] }
    expect(await carregarLembrete(falso({ perfil }).sb, 'u1', hoje)).toMatchObject({ minutos: 150, informado: false })        // segunda
    expect(await carregarLembrete(falso({ perfil }).sb, 'u1', '2026-10-04')).toMatchObject({ minutos: 0, informado: false })   // domingo
  })
  it('funciona mesmo sem a tabela de tempo (migração ainda não aplicada): cai no padrão', async () => {
    expect(await carregarLembrete(falso({ perfil: { nome: null, daily_minutes: 120, available_weekdays: [1] }, cap: null }).sb, 'u1', hoje)).toMatchObject({ minutos: 120, informado: false })
  })
  it('TODA consulta filtra pelo usuário (o agendador usa a chave administrativa, sem RLS)', async () => {
    const { sb, filtros } = falso({ perfil: { nome: 'A', daily_minutes: 60, available_weekdays: [1] } })
    await carregarLembrete(sb, 'usuario-42', hoje)
    expect(filtros.profiles).toContain('eq:id,usuario-42')
    for (const t of ['schedule_items', 'capacidade_dia', 'error_notebook']) expect(filtros[t]).toContain('eq:user_id,usuario-42')
    expect(filtros.schedule_items).toContain(`lte:data,${hoje}`); expect(filtros.schedule_items).toContain('neq:status,concluido')
  })
})
