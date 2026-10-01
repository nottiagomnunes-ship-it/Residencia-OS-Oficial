/** Separa o que está aberto em atrasado e de hoje, e calcula o progresso do dia. `feitasAgora` = ids concluídos nesta tela, antes de recarregar. */
export function resumoHoje<T extends { id: string; data: string }>(itens: T[], hoje: string, concluidasHoje: number, feitasAgora: ReadonlySet<string>) {
  const abertas = itens.filter(i => !feitasAgora.has(i.id))
  const deHojeOriginais = itens.filter(i => i.data === hoje)
  const feitas = concluidasHoje + deHojeOriginais.filter(i => feitasAgora.has(i.id)).length, total = concluidasHoje + deHojeOriginais.length
  return { atrasadas: abertas.filter(i => i.data < hoje), deHoje: abertas.filter(i => i.data === hoje), feitas, total, pct: total ? Math.round((feitas / total) * 100) : 0 }
}
