import type { SupabaseClient } from '@supabase/supabase-js'
import { montarDados } from './engine/lembretes'

/** Lê o que o usuário tem pendente hoje. Funciona com o cliente do usuário (RLS) ou com o administrativo (por isso filtra por user_id). */
export async function carregarLembrete(sb: SupabaseClient, uid: string, hoje: string) {
  const [{ data: p }, { data: rv }, { data: it }, { count }] = await Promise.all([
    sb.from('profiles').select('nome').eq('id', uid).maybeSingle(),
    sb.from('reviews').select('due_date,interval_days,topics(nome)').eq('user_id', uid).eq('status', 'pendente').lte('due_date', hoje).order('due_date'),
    sb.from('schedule_items').select('titulo,tipo,hora_ini').eq('user_id', uid).eq('data', hoje).neq('tipo', 'revisao').neq('status', 'concluido').order('hora_ini', { nullsFirst: false }),
    sb.from('error_notebook').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('revisado', false).lte('revisar_em', hoje),
  ])
  const revisoes = (rv ?? []).map((r: any) => ({ due_date: r.due_date as string, interval_days: r.interval_days as number, nome: (Array.isArray(r.topics) ? r.topics[0]?.nome : r.topics?.nome) ?? 'Assunto' }))
  return montarDados(p?.nome ?? null, hoje, revisoes, (it ?? []) as { titulo: string; tipo: string; hora_ini: string | null }[], count ?? 0)
}
