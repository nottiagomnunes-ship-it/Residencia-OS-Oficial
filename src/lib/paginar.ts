/** O Supabase (PostgREST) devolve no máximo 1000 linhas por pedido, mesmo com `.limit()` maior. */
export const PAGINA = 1000

type Resposta<T> = PromiseLike<{ data: T[] | null; error: unknown }>

/**
 * Busca todas as linhas de uma consulta, de 1000 em 1000, até `max`. A consulta recebe o intervalo (`de`, `ate`) para o `.range()`
 * e deve ter uma ordem estável (ex.: `.order('id')`), senão as páginas podem repetir ou pular linhas.
 * Erro na primeira página: `{ data: null, error }`, como a consulta original; erro depois: devolve o que já veio.
 */
export async function todasAsLinhas<T>(consulta: (de: number, ate: number) => Resposta<T>, max = 20000): Promise<{ data: T[] | null; error: any }> {
  const linhas: T[] = []
  for (let de = 0; de < max; de += PAGINA) {
    const ate = Math.min(de + PAGINA, max) - 1
    const { data, error } = await consulta(de, ate)
    if (error) return { data: linhas.length ? linhas : null, error }
    linhas.push(...(data ?? []))
    if (!data || data.length < ate - de + 1) break
  }
  return { data: linhas, error: null }
}

/** Roda `consulta` com os ids em blocos de 200 (um `.in()` com milhares de ids estoura o tamanho da URL) e junta as linhas. */
export async function emBlocos<T>(ids: string[], consulta: (bloco: string[]) => Resposta<T>, tamanho = 200): Promise<{ data: T[] | null; error: any }> {
  const linhas: T[] = []
  for (let i = 0; i < ids.length; i += tamanho) {
    const { data, error } = await consulta(ids.slice(i, i + tamanho))
    if (error) return { data: linhas.length ? linhas : null, error }
    linhas.push(...(data ?? []))
  }
  return { data: linhas, error: null }
}
