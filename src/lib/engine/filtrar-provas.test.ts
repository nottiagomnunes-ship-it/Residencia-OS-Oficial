import { describe, it, expect } from 'vitest'
import { filtrarProvas, filtroAtivo, lerFiltroProvas, opcoesDoFiltro, type ProvaParaFazer } from './provas-banco'

const P = (id: string, nome: string, banca: string, ano: number, completa = true): ProvaParaFazer => ({ id, nome, banca, ano, total: 100, disponiveis: completa ? 100 : 40, completa })
const provas = [P('a', 'USP-SP 2025 – Acesso direto', 'USP-SP', 2025), P('b', 'UNIFESP 2024 – Acesso direto', 'UNIFESP', 2024, false), P('c', 'USP-SP 2024 – R+ Clínica', 'USP-SP', 2024), P('d', 'Revalida São Paulo 2023', 'SES-SP', 2023)]
const sit = (id: string): 'feitas' | 'andamento' | 'nao_feitas' => (id === 'a' ? 'feitas' : id === 'c' ? 'andamento' : 'nao_feitas')
const ids = (f: Parameters<typeof filtrarProvas>[1]) => filtrarProvas(provas, f, sit).map(p => p.id)

describe('filtrar provas', () => {
  it('sem filtro: todas', () => { expect(ids({})).toEqual(['a', 'b', 'c', 'd']); expect(filtroAtivo({ situacao: 'todas' })).toBe(false) })
  it('busca por palavras, sem acento e sem ordem', () => {
    expect(ids({ busca: 'usp 2024' })).toEqual(['c']); expect(ids({ busca: 'sao paulo' })).toEqual(['d']); expect(ids({ busca: 'acesso' })).toEqual(['a', 'b'])
  })
  it('banca, ano, situação e só completas', () => {
    expect(ids({ banca: 'USP-SP' })).toEqual(['a', 'c']); expect(ids({ ano: '2024' })).toEqual(['b', 'c'])
    expect(ids({ situacao: 'nao_feitas' })).toEqual(['b', 'd']); expect(ids({ situacao: 'andamento' })).toEqual(['c']); expect(ids({ situacao: 'feitas' })).toEqual(['a'])
    expect(ids({ completas: true })).toEqual(['a', 'c', 'd']); expect(ids({ banca: 'USP-SP', ano: '2025' })).toEqual(['a'])
  })
  it('lê o endereço ignorando valores inválidos', () => {
    expect(lerFiltroProvas({ busca: '  usp ', banca: 'USP-SP', ano: '2024', situacao: 'feitas', completas: '1' })).toEqual({ busca: 'usp', banca: 'USP-SP', ano: '2024', situacao: 'feitas', completas: true })
    expect(lerFiltroProvas({ ano: 'abc', situacao: 'x' })).toMatchObject({ ano: '', situacao: 'todas', completas: false })
  })
  it('opções: bancas em ordem e anos do mais novo ao mais antigo', () => {
    expect(opcoesDoFiltro(provas)).toEqual({ bancas: ['SES-SP', 'UNIFESP', 'USP-SP'], anos: [2025, 2024, 2023] })
  })
})
