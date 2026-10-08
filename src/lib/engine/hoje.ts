/** Separa o que está aberto em atrasado e de hoje, e calcula o progresso do dia. `feitasAgora` = ids concluídos nesta tela, antes de recarregar. */
export function resumoHoje<T extends { id: string; data: string }>(itens: T[], hoje: string, concluidasHoje: number, feitasAgora: ReadonlySet<string>) {
  const abertas = itens.filter(i => !feitasAgora.has(i.id))
  const deHojeOriginais = itens.filter(i => i.data === hoje)
  const feitas = concluidasHoje + deHojeOriginais.filter(i => feitasAgora.has(i.id)).length, total = concluidasHoje + deHojeOriginais.length
  return { atrasadas: abertas.filter(i => i.data < hoje), deHoje: abertas.filter(i => i.data === hoje), feitas, total, pct: total ? Math.round((feitas / total) * 100) : 0 }
}

/**
 * Frase embaixo da saudação em Hoje. "Cadastre conteúdos" só para quem ainda não tem nenhum assunto;
 * com assuntos e sem revisões, fala das tarefas do dia (antes dizia "cadastre conteúdos" mesmo com o plano pronto).
 */
export function fraseDoDia(revisoesHoje: number, atrasadas: number, temAssuntos: boolean, tarefasPendentes: number) {
  if (revisoesHoje + atrasadas > 0) {
    const r = `${revisoesHoje} ${revisoesHoje === 1 ? 'revisão' : 'revisões'} para hoje`
    return atrasadas ? `Você tem ${r} e ${atrasadas} ${atrasadas === 1 ? 'atrasada' : 'atrasadas'}.` : `Você tem ${r}.`
  }
  if (!temAssuntos) return 'Cadastre seus assuntos para começar o plano.'
  if (tarefasPendentes > 0) return `Nenhuma revisão pendente. ${tarefasPendentes === 1 ? '1 tarefa' : `${tarefasPendentes} tarefas`} no plano de hoje.`
  return 'Nenhuma revisão pendente e nada no plano de hoje.'
}

type ItemDoDia = { id: string; tipo: string; titulo: string; duracao_min: number | null; topic_id: string | null }
export type PrimeiroPasso =
  | { tipo: 'estudar'; titulo: string; minutos: number | null; href: string }
  | { tipo: 'sem-assuntos' }
  | { tipo: 'sem-plano-hoje' }
  | null

/**
 * O cartão "Comece por aqui" de Hoje, só enquanto a pessoa ainda não concluiu nenhuma tarefa:
 * aponta a primeira tarefa de estudo do dia; sem assuntos, leva ao cronograma pronto/importação; com assuntos mas nada hoje, ao cronograma.
 */
export function primeiroPasso(jaConcluiuAlgo: boolean, temAssuntos: boolean, itens: readonly ItemDoDia[]): PrimeiroPasso {
  if (jaConcluiuAlgo) return null
  if (!temAssuntos) return { tipo: 'sem-assuntos' }
  const t = itens.find(i => i.tipo === 'estudo' && i.topic_id)
  if (t) return { tipo: 'estudar', titulo: t.titulo, minutos: t.duracao_min, href: `/conteudos/${t.topic_id}` }
  return itens.length ? null : { tipo: 'sem-plano-hoje' }
}
