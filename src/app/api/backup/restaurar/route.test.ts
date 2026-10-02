import { describe, it, expect, vi, beforeEach } from 'vitest'
import { gzipSync } from 'zlib'

const h = vi.hoisted(() => ({ user: { id: 'u1', email: 'a@x.com' } as any, rpcRes: { data: { topics: 2 }, error: null } as any, rpcs: [] as any[], revalidadas: [] as string[], copias: 0 }))
vi.mock('@/lib/supabase/server', () => ({ supabaseServer: async () => ({ auth: { getUser: async () => ({ data: { user: h.user } }) }, rpc: async (nome: string, args: any) => { h.rpcs.push({ nome, args }); return h.rpcRes } }) }))
vi.mock('@/lib/backup-restauracao-data', () => ({
  contarAtuais: async () => ({ contagem: { topics: 5, schedule_items: 40, goals: 2 }, concluidos: 3 }),
  montarCopiaDeSeguranca: async () => { h.copias++; return { app: 'Residência OS', versao: 1, tabelas: { topics: [{ id: 'antigo' }] }, perfil: null } },
}))
vi.mock('next/cache', () => ({ revalidatePath: (p: string) => { h.revalidadas.push(p) } }))
vi.mock('@/lib/dates', () => ({ hojeBR: () => '2026-10-02' }))
import { POST } from './route'
import { montarBackup, TABELAS_BACKUP } from '@/lib/engine/exportar'

const tabelas = () => Object.fromEntries(TABELAS_BACKUP.map(t => [t, [] as any[]])) as Record<string, any[]>
const backup = (mod?: (t: Record<string, any[]>) => void) => {
  const t = tabelas()
  t.disciplines = [{ id: 'd1', user_id: 'u', nome: 'Clínica' }]
  t.topics = [{ id: 't1', user_id: 'u', discipline_id: 'd1', nome: 'Asma', status: 'concluido' }, { id: 't2', user_id: 'u', discipline_id: 'd1', nome: 'DM', status: 'planejado' }]
  t.schedule_items = [{ id: 's1', user_id: 'u', topic_id: 't2', titulo: 'DM' }]
  mod?.(t)
  return montarBackup({ id: 'u', nome: 'Tiago', xp: 100, lembrete_email: true }, t, 'a@x.com', '2026-09-20T12:00:00.000Z')
}
const pedido = (campos: { arquivo?: Blob | string | null; modo?: string; confirmacao?: string }) => {
  const f = new FormData()
  if (campos.modo !== undefined) f.set('modo', campos.modo)
  if (campos.arquivo !== null && campos.arquivo !== undefined) f.set('arquivo', typeof campos.arquivo === 'string' ? new File([campos.arquivo], 'backup.json') : new File([campos.arquivo], 'backup.json.gz'))
  if (campos.confirmacao !== undefined) f.set('confirmacao', campos.confirmacao)
  return new Request('http://localhost/api/backup/restaurar', { method: 'POST', body: f })
}
const corpo = async (r: Response) => ({ status: r.status, ...(await r.json()) })
beforeEach(() => { h.user = { id: 'u1', email: 'a@x.com' }; h.rpcRes = { data: { topics: 2 }, error: null }; h.rpcs.length = 0; h.revalidadas.length = 0; h.copias = 0 })

describe('proteções gerais', () => {
  it('sem sessão: 401 e nada é lido', async () => { h.user = null; const r = await corpo(await POST(pedido({ arquivo: '{}', modo: 'previa' }))); expect(r.status).toBe(401); expect(h.rpcs).toHaveLength(0) })
  it('pedido inválido: sem modo, modo desconhecido, sem arquivo, arquivo vazio', async () => {
    for (const p of [{ arquivo: '{}' }, { arquivo: '{}', modo: 'apagar' }, { modo: 'previa' }, { arquivo: '', modo: 'previa' }]) expect((await corpo(await POST(pedido(p)))).status).toBe(400)
  })
  it('arquivo que não é JSON, ou que não é do app, ou incompleto: mensagem clara e nada é alterado', async () => {
    expect(await corpo(await POST(pedido({ arquivo: 'não sou json', modo: 'previa' })))).toMatchObject({ status: 400, erro: expect.stringContaining('JSON válido') })
    expect(await corpo(await POST(pedido({ arquivo: JSON.stringify({ app: 'Outro', versao: 1, tabelas: {} }), modo: 'restaurar', confirmacao: 'RESTAURAR' })))).toMatchObject({ status: 422, erro: expect.stringContaining('não parece') })
    const incompleto = backup(t => { delete t.reviews }); const r = await corpo(await POST(pedido({ arquivo: JSON.stringify(incompleto), modo: 'restaurar', confirmacao: 'RESTAURAR' })))
    expect(r.status).toBe(422); expect(r.erro).toContain('incompleto'); expect(h.rpcs).toHaveLength(0); expect(h.copias).toBe(0)
  })
  it('arquivo compactado (gzip) é aceito', async () => { const r = await corpo(await POST(pedido({ arquivo: new Blob([gzipSync(Buffer.from(JSON.stringify(backup())))]), modo: 'previa' }))); expect(r.status).toBe(200); expect(r.ok).toBe(true) })
})

describe('prévia (não altera nada)', () => {
  it('mostra no backup × hoje, com avisos de backup antigo e de progresso desfeito', async () => {
    const r = await corpo(await POST(pedido({ arquivo: JSON.stringify(backup()), modo: 'previa' })))
    expect(r.status).toBe(200); expect(r.previa.exportadoEm).toBe('2026-09-20T12:00:00.000Z'); expect(r.previa.conta).toBe('a@x.com')
    const por = Object.fromEntries(r.previa.linhas.map((l: any) => [l.tabela, l])); expect(por.topics).toMatchObject({ backup: 2, atual: 5, mudanca: 'menos' }); expect(por.schedule_items).toMatchObject({ backup: 1, atual: 40 })
    expect(r.previa.avisos.join(' ')).toContain('12 dias'); expect(r.previa.avisos.join(' ')).toContain('1 assuntos concluídos'); expect(r.previa.concluidos).toEqual({ backup: 1, atual: 3 })
    expect(h.rpcs).toHaveLength(0); expect(h.copias).toBe(0); expect(h.revalidadas).toHaveLength(0)         // nada foi gravado nem guardado
  })
})

describe('restaurar', () => {
  it('sem a palavra de confirmação, ou com outra: recusa antes de tocar em qualquer coisa', async () => {
    for (const c of [undefined, '', 'sim', 'RESTAURA', 'APAGAR']) { const r = await corpo(await POST(pedido({ arquivo: JSON.stringify(backup()), modo: 'restaurar', confirmacao: c }))); expect(r.status).toBe(400); expect(r.erro).toContain('RESTAURAR') }
    expect(h.rpcs).toHaveLength(0); expect(h.copias).toBe(0)
  })
  it('a confirmação aceita minúsculas e espaços', async () => { const r = await corpo(await POST(pedido({ arquivo: JSON.stringify(backup()), modo: 'restaurar', confirmacao: '  restaurar ' }))); expect(r.status).toBe(200) })
  it('guarda a cópia de segurança e envia ao banco dados com ids NOVOS, ligações refeitas, sem user_id e só o perfil permitido', async () => {
    const r = await corpo(await POST(pedido({ arquivo: JSON.stringify(backup()), modo: 'restaurar', confirmacao: 'RESTAURAR' })))
    expect(r).toMatchObject({ status: 200, ok: true, restauradas: { topics: 2 }, descartadas: {} })
    expect(h.copias).toBe(1); expect(h.rpcs).toHaveLength(1); const { nome, args } = h.rpcs[0]
    expect(nome).toBe('restaurar_backup'); expect(args.p_snapshot.tabelas.topics[0].id).toBe('antigo')             // a cópia do estado de ANTES
    const t = args.p_dados.topics; expect(t.map((x: any) => x.nome)).toEqual(['Asma', 'DM']); expect(t.every((x: any) => !['t1', 't2'].includes(x.id))).toBe(true)
    expect(args.p_dados.disciplines[0].id).not.toBe('d1'); expect(t[0].discipline_id).toBe(args.p_dados.disciplines[0].id)
    expect(args.p_dados.schedule_items[0].topic_id).toBe(t[1].id)                                                   // a tarefa da DM aponta para a DM nova
    expect(JSON.stringify(args.p_dados)).not.toContain('user_id'); expect(args.p_perfil).toEqual({ nome: 'Tiago', xp: 100 })   // lembrete_email NÃO passa
  })
  it('atualiza as telas depois de restaurar', async () => { await POST(pedido({ arquivo: JSON.stringify(backup()), modo: 'restaurar', confirmacao: 'RESTAURAR' })); expect(h.revalidadas).toEqual(expect.arrayContaining(['/inicio', '/calendario', '/configuracoes'])) })
  it('linhas sem "pai" no arquivo são contadas como descartadas (e a pessoa é informada)', async () => {
    const quebrado = backup(t => { t.schedule_items.push({ id: 's2', user_id: 'u', topic_id: 'nao-existe', titulo: 'órfã' }); t.reviews = [{ id: 'r1', user_id: 'u', topic_id: 'nao-existe', numero: 1 }] })
    const r = await corpo(await POST(pedido({ arquivo: JSON.stringify(quebrado), modo: 'restaurar', confirmacao: 'RESTAURAR' })))
    expect(r.descartadas).toEqual({ reviews: 1 }); expect(h.rpcs[0].args.p_dados.reviews).toHaveLength(0)
  })
  it('falha no banco: mensagem clara, "nada foi alterado", e as telas NÃO são atualizadas', async () => {
    h.rpcRes = { data: null, error: { message: 'invalid input syntax for type date: "banana"' } }
    const r = await corpo(await POST(pedido({ arquivo: JSON.stringify(backup()), modo: 'restaurar', confirmacao: 'RESTAURAR' })))
    expect(r.status).toBe(500); expect(r.erro).toContain('Nada foi alterado'); expect(r.detalhe).toContain('banana'); expect(h.revalidadas).toHaveLength(0)
  })
  it('o arquivo sozinho nunca decide quem é o dono: a rota não repassa user_id nem a conta do arquivo', async () => {
    const a = backup(t => { t.topics[0].user_id = 'OUTRA-PESSOA' }); await POST(pedido({ arquivo: JSON.stringify({ ...a, conta: 'invasor@x.com' }), modo: 'restaurar', confirmacao: 'RESTAURAR' }))
    expect(JSON.stringify(h.rpcs[0].args)).not.toContain('OUTRA-PESSOA'); expect(JSON.stringify(h.rpcs[0].args.p_dados)).not.toContain('invasor')
  })
})
