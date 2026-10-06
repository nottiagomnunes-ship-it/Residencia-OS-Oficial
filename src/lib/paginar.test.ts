import { describe, it, expect } from 'vitest'
import { todasAsLinhas, emBlocos } from './paginar'

// simula o Supabase: devolve no máximo 1000 linhas por pedido, mesmo pedindo mais
const banco = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i }))
const fake = (linhas: { id: number }[]) => (de: number, ate: number) => Promise.resolve({ data: linhas.slice(de, Math.min(ate + 1, de + 1000)), error: null })

describe('todasAsLinhas', () => {
  it('passa de 1000: junta as páginas', async () => {
    const { data } = await todasAsLinhas(fake(banco(2345)))
    expect(data).toHaveLength(2345)
    expect(new Set(data!.map(x => x.id)).size).toBe(2345)
  })
  it('exatamente 1000: faz um pedido a mais e para', async () => {
    let pedidos = 0
    const { data } = await todasAsLinhas((de, ate) => { pedidos++; return fake(banco(1000))(de, ate) })
    expect(data).toHaveLength(1000); expect(pedidos).toBe(2)
  })
  it('respeita o máximo', async () => {
    const { data } = await todasAsLinhas(fake(banco(5000)), 2500)
    expect(data).toHaveLength(2500)
  })
  it('erro no primeiro pedido: data null, como a consulta original', async () => {
    const r = await todasAsLinhas(() => Promise.resolve({ data: null, error: { message: 'sem tabela' } }))
    expect(r.data).toBeNull(); expect(r.error).toEqual({ message: 'sem tabela' })
  })
})

describe('emBlocos', () => {
  it('divide os ids e junta as respostas', async () => {
    const tamanhos: number[] = []
    const ids = Array.from({ length: 450 }, (_, i) => String(i))
    const { data } = await emBlocos(ids, b => { tamanhos.push(b.length); return Promise.resolve({ data: b.map(id => ({ id })), error: null }) })
    expect(tamanhos).toEqual([200, 200, 50]); expect(data).toHaveLength(450)
  })
})
