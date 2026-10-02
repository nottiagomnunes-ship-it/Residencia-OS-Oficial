import { describe, it, expect } from 'vitest'
import { gzipSync } from 'zlib'
import { lerArquivoDeBackup } from './backup-arquivo'

const json = { app: 'Residência OS', versao: 1, tabelas: {} }
describe('lerArquivoDeBackup', () => {
  it('JSON puro, com ou sem BOM', () => {
    expect(lerArquivoDeBackup(Buffer.from(JSON.stringify(json)))).toEqual({ ok: true, dados: json })
    expect(lerArquivoDeBackup(Buffer.from('\uFEFF' + JSON.stringify(json)))).toEqual({ ok: true, dados: json })
  })
  it('JSON compactado (gzip), como o app envia', () => { expect(lerArquivoDeBackup(gzipSync(Buffer.from(JSON.stringify(json))))).toEqual({ ok: true, dados: json }) })
  it('acentos sobrevivem à compactação', () => { const r = lerArquivoDeBackup(gzipSync(Buffer.from(JSON.stringify({ nome: 'Hipertensão — Clínica Médica' })))); expect(r).toEqual({ ok: true, dados: { nome: 'Hipertensão — Clínica Médica' } }) })
  it('texto que não é JSON, vazio ou lixo: mensagem clara', () => {
    for (const b of [Buffer.from('isto não é json'), Buffer.from(''), Buffer.from('{"app":'), Buffer.from([0, 1, 2, 3])]) { const r = lerArquivoDeBackup(b); expect(r.ok).toBe(false); expect((r as any).erro).toContain('JSON válido') }
  })
  it('gzip corrompido', () => { const g = gzipSync(Buffer.from(JSON.stringify(json))); g[g.length - 6] ^= 0xff; const r = lerArquivoDeBackup(g); expect(r.ok).toBe(false); expect((r as any).erro).toContain('corrompido') })
  it('arquivo "bomba" (pequeno compactado, enorme aberto) é barrado pelo limite', () => {
    const bomba = gzipSync(Buffer.alloc(200_000)); expect(bomba.length).toBeLessThan(2000)
    const r = lerArquivoDeBackup(bomba, 50_000); expect(r.ok).toBe(false); expect((r as any).erro).toContain('grande demais')
  })
  it('um arquivo grande porém legítimo dentro do limite passa', () => { const grande = { linhas: Array.from({ length: 20_000 }, (_, i) => ({ i, t: 'x'.repeat(20) })) }; expect(lerArquivoDeBackup(gzipSync(Buffer.from(JSON.stringify(grande))), 5_000_000).ok).toBe(true) })
})
