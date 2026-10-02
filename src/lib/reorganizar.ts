'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { hojeBR } from '@/lib/dates'
import { addDays, diffDays } from '@/lib/engine/review'
import { capacidadeDoDia } from '@/lib/engine/tempo'
import { reorganizarAtrasadas as calcularMovimentos, type ItemPlano } from '@/lib/engine/reorganizar'

const DIAS = 21 // até quantos dias à frente a reorganização procura espaço
const ADIANTAVEIS = ['estudo', 'questoes', 'flashcards'] // revisões e simulados não são adiantados: o prazo da revisão importa e o simulado precisa de um bloco grande
const COLS = 'id,tipo,titulo,data,duracao_min,ordem_dia'
const refresh = () => ['/inicio', '/cronograma', '/calendario', '/revisoes'].forEach(p => revalidatePath(p, 'layout'))

async function ctx() {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  return { sb, uid: user.id }
}

async function calcular() {
  const { sb, uid } = await ctx()
  const hoje = hojeBR(), fim = addDays(hoje, DIAS - 1)
  const [{ data: atr }, { data: abertos }, { data: caps }, { data: p }, { data: feitos }] = await Promise.all([
    sb.from('schedule_items').select(COLS).lt('data', hoje).neq('status', 'concluido').order('data').limit(300),
    sb.from('schedule_items').select(COLS).gte('data', hoje).lte('data', fim).neq('status', 'concluido').limit(1000),
    sb.from('capacidade_dia').select('data,minutos').gte('data', hoje).lte('data', fim),
    sb.from('profiles').select('daily_minutes,available_weekdays,exam_date').eq('id', uid).single(),
    sb.from('schedule_items').select('duracao_min').eq('data', hoje).eq('status', 'concluido'),
  ])
  const informados = Object.fromEntries((caps ?? []).map(c => [c.data as string, c.minutos as number]))
  const padrao = p?.daily_minutes ?? 120, disponiveis = p?.available_weekdays ?? [1, 2, 3, 4, 5]
  const limite = p?.exam_date && p.exam_date < fim ? (p.exam_date as string) : fim // não adianta empurrar tarefas para depois da prova
  const r = calcularMovimentos({
    hoje, dias: Math.max(1, diffDays(hoje, limite) + 1), atrasadas: (atr ?? []) as ItemPlano[], abertos: (abertos ?? []) as ItemPlano[],
    capacidade: d => capacidadeDoDia(d, informados, padrao, disponiveis).minutos, feitosHoje: (feitos ?? []).reduce((s, x) => s + (x.duracao_min ?? 30), 0),
  })
  return { sb, hoje, r, total: (atr ?? []).length }
}

export type Previa = { hoje: string; total: number; semLugar: number; porDia: { data: string; qtd: number; min: number }[] }

/** Mostra como as atrasadas ficariam, sem mudar nada. */
export async function previaReorganizar(): Promise<Previa> {
  const { hoje, r, total } = await calcular()
  const dias = new Map<string, { qtd: number; min: number }>()
  for (const m of r.movimentos) { const d = dias.get(m.para) ?? { qtd: 0, min: 0 }; dias.set(m.para, { qtd: d.qtd + 1, min: d.min + m.duracao_min }) }
  return { hoje, total, semLugar: r.semLugar.length, porDia: [...dias].sort(([a], [b]) => a.localeCompare(b)).map(([data, v]) => ({ data, ...v })) }
}

/** Aplica a reorganização (recalcula na hora, para refletir o estado atual) numa transação só. */
export async function reorganizarAtrasadas(): Promise<{ movidas: number; semLugar: number; erro?: string }> {
  const { sb, r } = await calcular()
  if (!r.movimentos.length) return { movidas: 0, semLugar: r.semLugar.length }
  const { data, error } = await sb.rpc('aplicar_movimentos', { p_mov: r.movimentos.map(m => ({ id: m.id, data: m.para, ordem_dia: m.ordem_dia })) })
  if (error) return { movidas: 0, semLugar: r.semLugar.length, erro: 'Não foi possível reorganizar. Nada foi alterado; tente de novo.' }
  refresh()
  return { movidas: (data as number) ?? r.movimentos.length, semLugar: r.semLugar.length }
}

/** Puxa para hoje tarefas dos próximos dias (só estudo, questões e flashcards), no fim da lista de hoje. */
export async function adiantarTarefas(ids: string[]): Promise<{ movidas: number; erro?: string }> {
  const { sb } = await ctx(), hoje = hojeBR()
  const [{ data: itens }, { data: deHoje }] = await Promise.all([
    sb.from('schedule_items').select('id,data,ordem_dia').in('id', ids.slice(0, 20)).neq('status', 'concluido').gt('data', hoje).in('tipo', ADIANTAVEIS),
    sb.from('schedule_items').select('ordem_dia').eq('data', hoje).neq('status', 'concluido'),
  ])
  if (!itens?.length) return { movidas: 0 }
  const ordem = Math.max(0, ...(deHoje ?? []).map(x => x.ordem_dia ?? 0))
  const mov = [...itens].sort((a, b) => a.data.localeCompare(b.data) || (a.ordem_dia ?? 1e9) - (b.ordem_dia ?? 1e9)).map((x, k) => ({ id: x.id, data: hoje, ordem_dia: ordem + 1 + k }))
  const { data, error } = await sb.rpc('aplicar_movimentos', { p_mov: mov })
  if (error) return { movidas: 0, erro: 'Não foi possível adiantar. Nada foi alterado; tente de novo.' }
  refresh()
  return { movidas: (data as number) ?? mov.length }
}
