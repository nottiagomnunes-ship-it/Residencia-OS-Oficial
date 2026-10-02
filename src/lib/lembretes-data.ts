import type { SupabaseClient } from '@supabase/supabase-js'
import { montarDados } from './engine/lembretes'
import { capacidadeDoDia } from './engine/tempo'

/**
 * Lê o que a pessoa tem aberto hoje, na mesma ordem do painel Hoje do app, e o tempo de estudo de hoje.
 * Funciona com o cliente do usuário (RLS) ou com o administrativo (por isso filtra por user_id em tudo).
 */
export async function carregarLembrete(sb: SupabaseClient, uid: string, hoje: string) {
  const [{ data: p }, { data: it }, { data: cap }, { count }] = await Promise.all([
    sb.from('profiles').select('nome,daily_minutes,available_weekdays').eq('id', uid).maybeSingle(),
    sb.from('schedule_items').select('titulo,tipo,data,duracao_min').eq('user_id', uid).lte('data', hoje).neq('status', 'concluido')
      .order('data').order('ordem_dia', { nullsFirst: false }).order('hora_ini', { nullsFirst: false }).limit(200),
    sb.from('capacidade_dia').select('minutos').eq('user_id', uid).eq('data', hoje).maybeSingle(),
    sb.from('error_notebook').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('revisado', false).lte('revisar_em', hoje),
  ])
  const tempo = capacidadeDoDia(hoje, cap ? { [hoje]: cap.minutos as number } : {}, p?.daily_minutes ?? 120, p?.available_weekdays ?? [1, 2, 3, 4, 5])
  return montarDados(p?.nome ?? null, hoje, (it ?? []) as { titulo: string; tipo: string; data: string; duracao_min: number | null }[], tempo.minutos, tempo.informado, count ?? 0)
}
