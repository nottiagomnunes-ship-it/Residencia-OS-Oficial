import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { prepararRestauracao, validarBackup } from './engine/restauracao'
import { montarBackup, TABELAS_BACKUP } from './engine/exportar'

const ler = (p: string) => readFileSync(p, 'utf8')
const arquivos = (d: string): string[] => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? arquivos(p) : [p] })

describe('áreas: não quebram quem ainda não aplicou o SQL', () => {
  it('a migração cria só o campo, com a regra das 5 áreas e sem apagar nada', () => {
    const m = ler('supabase/migrations/0027_areas_das_disciplinas.sql'); expect(m).toContain('alter table disciplines add column area text check (area in (\'clinica\', \'cirurgia\', \'pediatria\', \'go\', \'preventiva\'))'); expect(m).not.toMatch(/drop |delete |truncate /i)
  })
  it('GUARDA: o campo "area" só é lido pelo carregador próprio (uma consulta separada, que falha sozinha). Nenhuma outra consulta de disciplinas o seleciona', () => {
    const fora = arquivos('src').filter(f => /\.tsx?$/.test(f) && !f.includes('.test.') && !f.endsWith('areas-data.ts') && !f.endsWith('areas.ts') && !f.includes('engine/'))
      .flatMap(f => (ler(f).match(/from\('disciplines'\)\.select\('[^']*\barea\b[^']*'\)/g) ?? []).map(m => `${f}: ${m}`))
    expect(fora).toEqual([])
  })
  it('o carregador compartilhado de Desempenho/Início/cronograma NÃO depende do campo novo', () => { expect(ler('src/lib/desempenho-data.ts')).not.toMatch(/\barea\b/); expect(ler('src/lib/schedule.ts')).not.toMatch(/disciplines'\)\.select\('[^']*\barea\b/) })
  it('cada página que usa áreas lê pelo carregador seguro e mostra algo útil quando ele indica "indisponível"', () => {
    for (const p of ['disciplinas', 'desempenho', 'conteudos', 'questoes', 'caderno-de-erros']) expect(ler(`src/app/(app)/${p}/page.tsx`), p).toContain('carregarAreas(sb)')
    expect(ler('src/app/(app)/disciplinas/page.tsx')).toContain('0027_areas_das_disciplinas'); expect(ler('src/app/(app)/disciplinas/page.tsx')).toContain('areas.disponivel')
  })
  it('as disciplinas NOVAS recebem a área sugerida em todos os caminhos de criação', () => {
    expect(ler('src/lib/actions.ts')).toContain("atribuirAreasPorNome(sb, [String(fd.get('nome')).trim()])"); expect(ler('src/lib/importar.ts')).toContain('atribuirAreasPorNome(sb, disciplinas.map(d => d.nome))'); expect(ler('src/app/onboarding/page.tsx')).toContain('atribuirAreasPorNome(sb, DISCIPLINAS)')
  })
  it('as ações do servidor de áreas só exportam funções', () => { expect(ler('src/lib/areas.ts')).not.toMatch(/^export (const|let|var|class|enum) (?![A-Za-z_]+ = async)/m) })
})

describe('backup e restauração levam a área', () => {
  const tabelas = () => Object.fromEntries(TABELAS_BACKUP.map(t => [t, [] as any[]])) as Record<string, any[]>
  const bk = (disc: any[]) => { const t = tabelas(); t.disciplines = disc; return JSON.parse(JSON.stringify(montarBackup({ id: 'u' }, t, 'a@x', '2026-10-01T00:00:00Z'))) }
  it('a área sai no backup e entra de volta na restauração, junto com o resto da linha', () => {
    const v = validarBackup(bk([{ id: 'd1', user_id: 'u', nome: 'Cardiologia', area: 'clinica', peso: 3 }, { id: 'd2', user_id: 'u', nome: 'Anatomia', area: null, peso: 3 }])); expect(v.ok).toBe(true)
    const p = prepararRestauracao((v as any).backup, () => crypto.randomUUID()); expect(p.dados.disciplines.map(d => [d.nome, d.area])).toEqual([['Cardiologia', 'clinica'], ['Anatomia', null]])
  })
  it('backup de antes das áreas (sem o campo) continua válido e as disciplinas entram sem o campo (ficam sem área)', () => {
    const v = validarBackup(bk([{ id: 'd1', user_id: 'u', nome: 'Cardiologia', peso: 3 }])); expect(v.ok).toBe(true)
    const p = prepararRestauracao((v as any).backup, () => crypto.randomUUID()); expect(p.dados.disciplines[0]).not.toHaveProperty('area')
  })
})
