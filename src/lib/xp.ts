import type { SupabaseClient } from '@supabase/supabase-js'
import { levelFor } from './engine/review'
import { carregarGamificacao } from './gamificacao-data'
import { hojeBR } from './dates'

/** Soma XP ao perfil (recalcula o nível) e acumula minutos/questões/acertos nas estatísticas do dia. */
export async function somarDia(sb: SupabaseClient, uid: string, dia: string, d: { xp: number; minutos?: number; questoes?: number; acertos?: number }) {
  const { data: p } = await sb.from('profiles').select('xp').eq('id', uid).single()
  const total = (p?.xp ?? 0) + d.xp
  await sb.from('profiles').update({ xp: total, level: levelFor(total) }).eq('id', uid)
  const { data: s } = await sb.from('daily_stats').select('minutos,questoes,acertos,xp').eq('user_id', uid).eq('data', dia).maybeSingle()
  await sb.from('daily_stats').upsert({ user_id: uid, data: dia, minutos: (s?.minutos ?? 0) + (d.minutos ?? 0), questoes: (s?.questoes ?? 0) + (d.questoes ?? 0), acertos: (s?.acertos ?? 0) + (d.acertos ?? 0), xp: (s?.xp ?? 0) + d.xp })
  await carregarGamificacao(sb, hojeBR()).catch(() => {}) // detecta conquistas novas logo após a ação
}
/** "d:<id>" = disciplina inteira, "t:<id>" = assunto (a disciplina vem do assunto). */
export async function resolverAlvo(sb: SupabaseClient, v: string) {
  const [k, id] = v.split(':')
  if (k === 't') { const { data } = await sb.from('topics').select('id,discipline_id').eq('id', id).single(); return { topic_id: data?.id ?? null, discipline_id: data?.discipline_id ?? null } }
  return { topic_id: null, discipline_id: id || null }
}
