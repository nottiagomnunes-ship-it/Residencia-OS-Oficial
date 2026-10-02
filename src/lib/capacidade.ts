'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { addDays } from '@/lib/engine/review'
import { hojeBR } from '@/lib/dates'

async function ctx() {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  return { sb, uid: user.id }
}
const ISO = /^\d{4}-\d{2}-\d{2}$/
/** Registra que o tempo da semana mudou, para avisar que o cronograma precisa ser atualizado. Sem a migração 0021 só não registra. */
const marcarAlterada = (sb: Awaited<ReturnType<typeof ctx>>['sb'], uid: string) => sb.from('profiles').update({ capacidade_alterada_em: new Date().toISOString() }).eq('id', uid)
const refresh = () => ['/semana', '/inicio'].forEach(p => revalidatePath(p, 'layout'))

/** Tempo de estudo que a pessoa tem em um dia (0 = sem estudo). */
export async function definirCapacidade(data: string, minutos: number) {
  const { sb, uid } = await ctx()
  if (!ISO.test(data) || !Number.isInteger(minutos) || minutos < 0 || minutos > 960) return
  await sb.from('capacidade_dia').upsert({ user_id: uid, data, minutos })
  if (data > hojeBR()) await marcarAlterada(sb, uid) // mudar o tempo de HOJE só ajusta a lista de hoje; os outros dias pedem um cronograma novo
  refresh()
}
/** Volta ao tempo padrão nos dias do intervalo. */
export async function limparCapacidade(inicio: string, fim: string) {
  const { sb, uid } = await ctx()
  if (!ISO.test(inicio) || !ISO.test(fim)) return
  await sb.from('capacidade_dia').delete().gte('data', inicio).lte('data', fim)
  await marcarAlterada(sb, uid)
  refresh()
}
/** Repete na semana que começa em `segunda` os tempos informados na semana anterior. */
export async function copiarSemanaAnterior(segunda: string) {
  const { sb, uid } = await ctx()
  if (!ISO.test(segunda)) return
  const { data } = await sb.from('capacidade_dia').select('data,minutos').gte('data', addDays(segunda, -7)).lte('data', addDays(segunda, -1))
  if (data?.length) { await sb.from('capacidade_dia').upsert(data.map(r => ({ user_id: uid, data: addDays(r.data, 7), minutos: r.minutos }))); await marcarAlterada(sb, uid) }
  refresh()
}
/** Remove os horários e compromissos do modelo antigo de "Minha semana", que não são mais usados. */
export async function apagarCompromissosAntigos() {
  const { sb, uid } = await ctx()
  await sb.from('commitments').delete().eq('user_id', uid)
  revalidatePath('/semana'); revalidatePath('/calendario'); revalidatePath('/cronograma')
}
/** "Agora não": não lembrar de novo desta semana (volta a lembrar na seguinte). */
export async function dispensarAvisoSemana(segunda: string) {
  const { sb, uid } = await ctx()
  if (!ISO.test(segunda)) return
  await sb.from('profiles').update({ semana_aviso: segunda }).eq('id', uid)
  revalidatePath('/inicio', 'layout')
}
