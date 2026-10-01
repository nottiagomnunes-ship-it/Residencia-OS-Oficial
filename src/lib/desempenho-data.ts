import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays } from './engine/review'
import { agregarPor, pct, prioridadeAssunto, recomendacoes, serieSemanal, type SetQ } from './engine/desempenho'

/** Carrega e calcula tudo que Desempenho, Início e o gerador de cronograma precisam. */
export async function carregarDesempenho(sb: SupabaseClient, hoje: string) {
  const [{ data: ds }, { data: ts }, { data: sets }, { data: rv }, { data: er }, { data: st }, { data: pf }] = await Promise.all([
    sb.from('disciplines').select('id,nome,cor').order('ordem'),
    sb.from('topics').select('id,nome,discipline_id,status'),
    sb.from('question_sets').select('discipline_id,topic_id,total,acertos,realizado_em').order('realizado_em', { ascending: false }).limit(10000),
    sb.from('reviews').select('topic_id').eq('status', 'pendente').lt('due_date', hoje),
    sb.from('error_notebook').select('topic_id').eq('motivo', 'falta_conteudo').not('topic_id', 'is', null),
    sb.from('daily_stats').select('data,minutos').gte('data', addDays(hoje, -56)),
    sb.from('profiles').select('limite_foco,min_questoes').single(),
  ])
  const cfg = { limite: pf?.limite_foco ?? 65, minimo: pf?.min_questoes ?? 10 }
  const S = (sets ?? []) as SetQ[], porD = agregarPor(S, 'discipline_id'), porT = agregarPor(S, 'topic_id')
  const conta = (l: { topic_id: string | null }[] | null) => { const m = new Map<string, number>(); (l ?? []).forEach(x => x.topic_id && m.set(x.topic_id, (m.get(x.topic_id) ?? 0) + 1)); return m }
  const atras = conta(rv), errosC = conta(er)

  const disciplinas = (ds ?? []).map(d => {
    const a = porD.get(d.id) ?? { total: 0, acertos: 0 }, t = (ts ?? []).filter(x => x.discipline_id === d.id)
    return { id: d.id, nome: d.nome, cor: d.cor as string, ...a, pct: pct(a.acertos, a.total), progresso: t.length ? Math.round((t.filter(x => x.status === 'concluido').length / t.length) * 100) : 0 }
  })
  const assuntos = (ts ?? []).map(t => {
    const a = porT.get(t.id) ?? { total: 0, acertos: 0 }
    return { id: t.id, nome: t.nome, disciplineId: t.discipline_id as string, status: t.status as string, ...a, pct: pct(a.acertos, a.total),
      ...prioridadeAssunto({ nome: t.nome, ...a, revisoesAtrasadas: atras.get(t.id) ?? 0, errosConteudo: errosC.get(t.id) ?? 0 }, cfg) }
  })
  return {
    total: S.reduce((n, x) => n + x.total, 0), acertos: S.reduce((n, x) => n + x.acertos, 0), disciplinas, assuntos,
    foco: assuntos.filter(a => a.nivel !== 'baixa').sort((x, y) => y.pontos - x.pontos),
    recomendacoes: recomendacoes(S, ds ?? [], 50, 30, cfg.limite), serie: serieSemanal(S, st ?? [], hoje),
  }
}
