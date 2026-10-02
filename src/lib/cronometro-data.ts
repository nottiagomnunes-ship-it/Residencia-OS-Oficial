import type { SupabaseClient } from '@supabase/supabase-js'
import type { Cron } from './engine/cronometro'

export const COLS_CRON = 'id,item_id,tipo,titulo,topic_id,review_id,planejado_min,qtd_questoes,iniciado_em,acumulado_seg,pausado'

/** O cronômetro em andamento, se houver. `disponivel` é falso se a migração 0025 ainda não foi aplicada (o app segue normal, sem cronômetro). */
export async function carregarCronometro(sb: SupabaseClient): Promise<{ disponivel: boolean; ativo: Cron | null }> {
  const { data, error } = await sb.from('cronometros').select(COLS_CRON).maybeSingle()
  if (error) return { disponivel: false, ativo: null }
  return { disponivel: true, ativo: (data as Cron | null) ?? null }
}
