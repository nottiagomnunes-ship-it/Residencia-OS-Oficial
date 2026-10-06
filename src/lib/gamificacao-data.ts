import type { SupabaseClient } from '@supabase/supabase-js'
import { CONQUISTAS, assuntoCompleto, desbloqueadas, disciplinaCompleta, nivelDoXp, sequencias, type Stats } from './engine/gamificacao'
import { pct } from './engine/desempenho'
import { carregarMetas } from './metas-data'
import { rankDoProgresso } from './engine/rank'
import { todasAsLinhas } from '@/lib/paginar'

/** Total de assuntos e quantos estão concluídos (contagem no banco, sem o limite de linhas). */
export async function contarAssuntos(sb: SupabaseClient) {
  const [{ count: total }, { count: concluidos }] = await Promise.all([
    sb.from('topics').select('id', { count: 'exact', head: true }),
    sb.from('topics').select('id', { count: 'exact', head: true }).eq('status', 'concluido'),
  ])
  return { total: total ?? 0, concluidos: concluidos ?? 0 }
}

/**
 * Nível, sequência e conquistas. Conquistas novas são gravadas (visto = false) na primeira vez que o critério é atingido;
 * esta função também é chamada logo após as ações principais (somarDia, etapas, caderno) para o aviso aparecer na hora.
 */
export async function carregarGamificacao(sb: SupabaseClient, hoje: string) {
  const [{ data: p }, { data: st }, { data: qs }, { data: ts }, { data: et }, { data: er }, { data: ms }, { count: revisoes }, { data: ac }, metas, assuntos] = await Promise.all([
    sb.from('profiles').select('id,xp').single(),
    sb.from('daily_stats').select('data,minutos,questoes').order('data', { ascending: false }).limit(1000),
    todasAsLinhas((de, ate) => sb.from('question_sets').select('total,acertos').order('id').range(de, ate), 10000),
    sb.from('topics').select('discipline_id,status'),
    todasAsLinhas((de, ate) => sb.from('topic_tasks').select('topic_id,concluida').order('id').range(de, ate), 20000),
    todasAsLinhas((de, ate) => sb.from('error_notebook').select('revisado').order('id').range(de, ate), 20000),
    sb.from('mock_exams').select('total,acertos'),
    sb.from('reviews').select('id', { count: 'exact', head: true }).eq('status', 'concluida'),
    sb.from('achievements').select('codigo,desbloqueada_em,visto'),
    carregarMetas(sb, hoje), contarAssuntos(sb),
  ])
  const dias = (st ?? []).filter(x => x.minutos > 0 || x.questoes > 0).map(x => x.data), seq = sequencias(dias, hoje)
  const tq = (qs ?? []).reduce((n, x) => n + x.total, 0), aq = (qs ?? []).reduce((n, x) => n + x.acertos, 0)
  const stats: Stats = {
    melhorSequencia: seq.melhor, questoes: tq, conteudos: (ts ?? []).filter(t => t.status === 'concluido').length, revisoes: revisoes ?? 0,
    simulados: (ms ?? []).length, horas: Math.round((st ?? []).reduce((n, x) => n + x.minutos, 0) / 60),
    etapas: (et ?? []).filter(x => x.concluida).length, assuntoCompleto: assuntoCompleto(et ?? []),
    erros: (er ?? []).length, errosRevisados: (er ?? []).filter(x => x.revisado).length,
    simuladoMelhor: Math.max(0, ...(ms ?? []).filter(m => m.total >= 30).map(m => pct(m.acertos, m.total) ?? 0)),
    metaBatida: metas.some(m => m.pct >= 100), maiorDiaQuestoes: Math.max(0, ...(st ?? []).map(x => x.questoes)),
    maiorDiaMinutos: Math.max(0, ...(st ?? []).map(x => x.minutos)), acertoGeral: pct(aq, tq), disciplinaCompleta: disciplinaCompleta(ts ?? []),
  }
  const tem = new Map((ac ?? []).map(a => [a.codigo as string, a as { desbloqueada_em: string; visto: boolean }]))
  const novas = desbloqueadas(stats).filter(x => !tem.has(x))
  if (novas.length && p) await sb.from('achievements').upsert(novas.map(codigo => ({ user_id: p.id, codigo })), { onConflict: 'user_id,codigo', ignoreDuplicates: true })
  return {
    xp: p?.xp ?? 0, nivel: nivelDoXp(p?.xp ?? 0), rank: rankDoProgresso(assuntos.concluidos, assuntos.total), sequencia: seq, stats,
    conquistas: CONQUISTAS.map(x => ({
      codigo: x.codigo, titulo: x.titulo, descricao: x.descricao,
      em: tem.get(x.codigo)?.desbloqueada_em ?? (novas.includes(x.codigo) ? hoje : null),
      visto: tem.get(x.codigo)?.visto ?? !novas.includes(x.codigo),
    })),
  }
}
