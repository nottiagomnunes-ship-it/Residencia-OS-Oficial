import { describe, it, expect, vi } from 'vitest'
import { comprimirParaEnvio, LIMITE_PEDIDO_BYTES } from './comprimir'
import { lerArquivoDeBackup } from './backup-arquivo'
import { montarBackup, TABELAS_BACKUP } from './engine/exportar'
import { validarBackup } from './engine/restauracao'

// um backup grande (acima do limite em que o app passa a compactar), gerado pelo exportador de verdade
const grande = () => {
  const t: Record<string, any[]> = Object.fromEntries(TABELAS_BACKUP.map(k => [k, []]))
  t.disciplines = [{ id: 'd1', user_id: 'u', nome: 'Clínica Médica' }]
  t.topics = [{ id: 't1', user_id: 'u', discipline_id: 'd1', nome: 'Hipertensão — HAS', status: 'concluido' }]
  t.schedule_items = Array.from({ length: 4000 }, (_, i) => ({ id: 'si' + i, user_id: 'u', topic_id: 't1', titulo: `Revisão D${i % 4} — Hipertensão arterial sistêmica (Parte ${i})`, data: '2026-10-05', duracao_min: 30 }))
  return montarBackup({ id: 'u', nome: 'Tiago' }, t, 'a@x.com', '2026-10-01T00:00:00Z')
}

describe('compactar no navegador, ler no servidor', () => {
  it('o arquivo compactado pelo app é lido pelo servidor e dá exatamente o mesmo backup', async () => {
    const original = JSON.stringify(grande()), arquivo = new File([original], 'backup.json', { type: 'application/json' })
    expect(arquivo.size).toBeGreaterThan(256 * 1024)
    const blob = await comprimirParaEnvio(arquivo)
    expect(blob.size).toBeLessThan(arquivo.size / 5)                                   // JSON repetitivo compacta muito
    const lido = lerArquivoDeBackup(Buffer.from(await blob.arrayBuffer()))
    expect(lido.ok).toBe(true); expect((lido as any).dados).toEqual(JSON.parse(original))
    const v = validarBackup((lido as any).dados); expect(v.ok).toBe(true); expect((v as any).contagem.schedule_items).toBe(4000)
  })
  it('um backup que ULTRAPASSA o limite do envio sem compactar, cabe depois de compactado', async () => {
    const t = grande(); t.tabelas.schedule_items = Array.from({ length: 40_000 }, (_, i) => ({ id: 'si' + i, topic_id: 't1', titulo: `Revisão D${i % 4} — Hipertensão arterial sistêmica (Parte ${i})`, data: '2026-10-05', duracao_min: 30 }))
    const arquivo = new File([JSON.stringify(t)], 'backup.json'); expect(arquivo.size).toBeGreaterThan(LIMITE_PEDIDO_BYTES)
    expect((await comprimirParaEnvio(arquivo)).size).toBeLessThan(LIMITE_PEDIDO_BYTES)
  })
  it('arquivo pequeno segue como está (não vale compactar)', async () => { const f = new File(['{"a":1}'], 'b.json'); expect(await comprimirParaEnvio(f)).toBe(f) })
  it('navegador sem suporte à compactação: envia o original, sem quebrar', async () => {
    vi.stubGlobal('CompressionStream', undefined); const f = new File([JSON.stringify(grande())], 'b.json'); expect(await comprimirParaEnvio(f)).toBe(f); vi.unstubAllGlobals()
  })
})
