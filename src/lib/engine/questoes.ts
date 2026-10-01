export const MOTIVOS = {
  falta_conteudo: { rotulo: 'Falta de conteúdo', frase: 'são por falta de conteúdo', cor: 'text-danger', barra: 'bg-danger' },
  falta_atencao: { rotulo: 'Falta de atenção', frase: 'são por falta de atenção', cor: 'text-warn', barra: 'bg-warn' },
  confusao_conceitos: { rotulo: 'Confusão entre conceitos', frase: 'são por confusão entre conceitos', cor: 'text-violet', barra: 'bg-violet' },
  erro_interpretacao: { rotulo: 'Erro de interpretação', frase: 'são por erro de interpretação', cor: 'text-pink', barra: 'bg-pink' },
  chute: { rotulo: 'Chute', frase: 'foram chutes', cor: 'text-info', barra: 'bg-info' },
} as const
export type Motivo = keyof typeof MOTIVOS

export const aproveitamento = (acertos: number, total: number) => (total > 0 ? Math.round((acertos / total) * 100) : null)
export const xpQuestoes = (total: number) => Math.floor(total / 5)

/** Distribuição dos erros por motivo (do mais frequente ao menos) e a frase-resumo. */
export function estatisticasErros(erros: { motivo: string }[]) {
  const total = erros.length
  const linhas = (Object.keys(MOTIVOS) as Motivo[]).map(m => {
    const n = erros.filter(e => e.motivo === m).length
    return { motivo: m, n, pct: total ? Math.round((n / total) * 100) : 0 }
  }).sort((a, b) => b.n - a.n)
  const topo = linhas[0]
  return { total, linhas, frase: total && topo.n ? `${topo.pct}% dos seus erros ${MOTIVOS[topo.motivo].frase}.` : null }
}
