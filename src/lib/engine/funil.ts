/** Funil de primeiros passos (Administração): só contagens, sem nomes nem e-mails. A conta administradora fica de fora. */

export type Perfil = { id: string; onboarded: boolean | null; created_at: string | null }
export type Etapa = { rotulo: string; dica: string; n: number; pctTotal: number | null; pctAnterior: number | null }

export function montarFunil(e: { perfis: Perfil[]; admins: ReadonlySet<string>; comPlano: ReadonlySet<string>; diasAtivos: ReadonlyMap<string, ReadonlySet<string>>; desde?: string }) {
  const contas = e.perfis.filter(p => !e.admins.has(p.id) && (!e.desde || (p.created_at ?? '') >= e.desde))
  const ids = contas.map(p => p.id)
  const dias = (id: string) => e.diasAtivos.get(id)?.size ?? 0
  const grupos: [string, string, string[]][] = [
    ['Criaram conta', 'Cadastro concluído (e-mail ou Google).', ids],
    ['Terminaram o assistente', 'Responderam "Vamos montar seu plano".', ids.filter(id => contas.find(p => p.id === id)?.onboarded)],
    ['Têm um plano', 'Pelo menos um assunto (cronograma pronto, importado ou à mão).', ids.filter(id => e.comPlano.has(id))],
    ['Fizeram a 1ª atividade', 'Concluíram uma tarefa, revisaram, responderam questão ou usaram o cronômetro.', ids.filter(id => dias(id) >= 1)],
    ['Voltaram em outro dia', 'Atividade em pelo menos 2 dias diferentes.', ids.filter(id => dias(id) >= 2)],
  ]
  const total = ids.length
  const etapas: Etapa[] = grupos.map(([rotulo, dica, g], i) => {
    const anterior = i ? grupos[i - 1][2].length : null
    return { rotulo, dica, n: g.length, pctTotal: total ? Math.round((g.length / total) * 100) : null, pctAnterior: anterior ? Math.round((g.length / anterior) * 100) : null }
  })
  return { total, etapas }
}

/** Data (aaaa-mm-dd) de N dias atrás, para o recorte "contas novas". */
export const diasAtras = (hoje: string, n: number) => new Date(Date.parse(hoje + 'T12:00:00Z') - n * 86_400_000).toISOString().slice(0, 10)
