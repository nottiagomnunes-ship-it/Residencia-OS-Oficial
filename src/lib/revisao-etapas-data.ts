import type { SupabaseClient } from '@supabase/supabase-js'
import { PADRAO_REVISAO, type Etapa } from './engine/etapas'

const LOTE = 80 // ids por consulta, para a URL não ficar longa demais

/**
 * Mini-checklists das revisões informadas, por id da revisão. Quem ainda não tem recebe o padrão (desmarcado), uma única vez.
 * Só aparecem no resultado as revisões que têm checklist: se a migração 0020 ainda não foi aplicada, devolve vazio e o app segue normal.
 */
export async function etapasDasRevisoes(sb: SupabaseClient, ids: string[]): Promise<Record<string, Etapa[]>> {
  const out: Record<string, Etapa[]> = {}
  const unicos = [...new Set(ids.filter(Boolean))]
  for (let i = 0; i < unicos.length; i += LOTE) {
    const lote = unicos.slice(i, i + LOTE)
    const { data: rs, error } = await sb.from('reviews').select('id,etapas_semeadas').in('id', lote)
    if (error) return {}
    const faltam = (rs ?? []).filter(r => !r.etapas_semeadas).map(r => r.id as string)
    const comPadrao = new Set((rs ?? []).filter(r => r.etapas_semeadas).map(r => r.id as string))
    if (faltam.length) {
      const { data: novos, error: e2 } = await sb.rpc('semear_revisoes', { p_ids: faltam, p_padrao: PADRAO_REVISAO })
      if (e2) return {}
      for (const id of (novos ?? []) as string[]) comPadrao.add(id)
    }
    const { data } = await sb.from('review_tasks').select('id,review_id,tipo,titulo,qtd_questoes,concluida').in('review_id', lote).order('ordem').order('created_at')
    for (const id of comPadrao) out[id] = []
    for (const e of data ?? []) (out[e.review_id] ??= []).push({ id: e.id, tipo: e.tipo, titulo: e.titulo, qtd_questoes: e.qtd_questoes, concluida: e.concluida })
  }
  return out
}
