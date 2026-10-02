import type { SupabaseClient } from '@supabase/supabase-js'

/** Lê uma tabela inteira, de 1.000 em 1.000 (o Supabase limita cada resposta a 1.000 linhas). A RLS já restringe às linhas do usuário. */
export async function lerTudo(sb: SupabaseClient, tabela: string, ordem = 'id') {
  const out: Record<string, any>[] = []
  for (let de = 0; ; de += 1000) {
    const { data, error } = await sb.from(tabela).select('*').order(ordem).range(de, de + 999)
    if (error) { if (error.code === '42P01' || error.code === 'PGRST205') return out; throw error } // tabela de uma migração ainda não aplicada: sem linhas
    out.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return out
}
export async function lerTabelas(sb: SupabaseClient, nomes: readonly string[]) {
  const itens = await Promise.all(nomes.map(async n => [n, await lerTudo(sb, n, n === 'daily_stats' || n === 'capacidade_dia' ? 'data' : 'id')] as const))
  return Object.fromEntries(itens)
}
