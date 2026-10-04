export type ErroApp = { criado_em: string; origem: 'navegador' | 'servidor'; mensagem: string; digest?: string | null; pagina: string | null; detalhe: string | null; navegador?: string | null; user_id?: string | null }
export type GrupoDeErro = { mensagem: string; vezes: number; ultimo: string; origens: string[]; paginas: string[]; contas: number; detalhe: string | null }

/** Junta os erros iguais (mesma mensagem): quantas vezes, o último, em que páginas e quantas contas. Os mais recentes primeiro. */
export function agruparErros(erros: readonly ErroApp[]): GrupoDeErro[] {
  const m = new Map<string, { g: GrupoDeErro; contas: Set<string>; paginas: Set<string>; origens: Set<string> }>()
  for (const e of erros) {
    let x = m.get(e.mensagem)
    if (!x) { x = { g: { mensagem: e.mensagem, vezes: 0, ultimo: e.criado_em, origens: [], paginas: [], contas: 0, detalhe: e.detalhe }, contas: new Set(), paginas: new Set(), origens: new Set() }; m.set(e.mensagem, x) }
    x.g.vezes++
    if (e.criado_em > x.g.ultimo) { x.g.ultimo = e.criado_em; if (e.detalhe) x.g.detalhe = e.detalhe }
    if (!x.g.detalhe && e.detalhe) x.g.detalhe = e.detalhe
    if (e.user_id) x.contas.add(e.user_id)
    if (e.pagina) x.paginas.add(e.pagina)
    x.origens.add(e.origem)
  }
  return [...m.values()].map(({ g, contas, paginas, origens }) => ({ ...g, contas: contas.size, paginas: [...paginas].slice(0, 5), origens: [...origens].sort() }))
    .sort((a, b) => (a.ultimo < b.ultimo ? 1 : a.ultimo > b.ultimo ? -1 : 0))
}

/** Erros que não são erros de verdade (redirecionamentos e "não encontrado" do Next) não são registrados. */
export const ehErroDeControle = (digest?: string | null) => !!digest && /^(NEXT_REDIRECT|NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK)/.test(digest)
