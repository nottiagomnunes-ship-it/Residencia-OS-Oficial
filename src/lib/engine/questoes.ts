export const MOTIVOS = {
  falta_conteudo: { rotulo: 'Falta de conteúdo', frase: 'são por falta de conteúdo', cor: 'text-danger', barra: 'bg-danger' },
  falta_atencao: { rotulo: 'Falta de atenção', frase: 'são por falta de atenção', cor: 'text-warn', barra: 'bg-warn' },
  confusao_conceitos: { rotulo: 'Confusão entre conceitos', frase: 'são por confusão entre conceitos', cor: 'text-violet', barra: 'bg-violet' },
  erro_interpretacao: { rotulo: 'Erro de interpretação', frase: 'são por erro de interpretação', cor: 'text-pink', barra: 'bg-pink' },
  chute: { rotulo: 'Chute', frase: 'foram chutes', cor: 'text-info', barra: 'bg-info' },
} as const
export type Motivo = keyof typeof MOTIVOS

export const aproveitamento = (acertos: number, total: number) => (total > 0 ? Math.round((acertos / total) * 100) : null)
/** 1 XP a cada 2 questões (no máximo 200 por sessão) + bônus por acerto alto: 80% ou mais = +1 a cada 8; 70% a 79% = +1 a cada 16. */
export function xpQuestoes(total: number, acertos = 0) {
  const t = Math.min(Math.max(total, 0), 200), p = aproveitamento(acertos, total) ?? 0
  return Math.floor(t / 2) + (p >= 80 ? Math.floor(t / 8) : p >= 70 ? Math.floor(t / 16) : 0)
}

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

/** Resumo ao vivo enquanto se digita: erros e aproveitamento, ou o motivo de o registro ainda não poder ser feito. */
export function resumoQuestoes(total: string, acertos: string) {
  const t = Number(total), a = Number(acertos)
  const totalOk = total !== '' && Number.isInteger(t) && t >= 1, acertosOk = acertos !== '' && Number.isInteger(a) && a >= 0
  if (!totalOk || !acertosOk) return { valido: false, mensagem: null as string | null, tipo: 'neutro' as const }
  if (a > t) return { valido: false, mensagem: `Os acertos (${a}) não podem passar do total (${t}).`, tipo: 'erro' as const }
  const pct = aproveitamento(a, t)!, erros = t - a
  return { valido: true, mensagem: `${erros} ${erros === 1 ? 'erro' : 'erros'} · ${pct}% de aproveitamento`, tipo: (pct >= 75 ? 'bom' : pct >= 60 ? 'medio' : 'baixo') as 'bom' | 'medio' | 'baixo' }
}
