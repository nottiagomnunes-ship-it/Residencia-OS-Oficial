import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays } from './engine/review'
import { ocupadosPorData, paraCompromisso, type Intervalo } from './engine/compromissos'
import { janelaDoPerfil, livreDoDia, descreverJanelas, sugestaoDeEstudo, lerCores, corDaCategoria, type CoresAgenda } from './engine/agenda'
import { formatarMinutos } from './engine/tempo'

export type LinhaAgenda = { id: string; titulo: string; categoria: string; tipo: 'semanal' | 'pontual'; dias: number[]; data: string | null; hora_ini: string; hora_fim: string; valido_de: string | null; valido_ate: string | null; excecoes?: string[] }

/**
 * A agenda pessoal. Consulta SEPARADA de propósito: sem a atualização 0029 do banco (campos "agenda" e "categoria"), `disponivel` vem falso e
 * as telas seguem como antes, sem quebrar.
 */
export async function carregarAgenda(sb: SupabaseClient): Promise<{ disponivel: boolean; linhas: LinhaAgenda[] }> {
  const campos = 'id,titulo,categoria,tipo,dias,data,hora_ini,hora_fim,valido_de,valido_ate'
  const ler = (c: string) => sb.from('commitments').select(c).eq('agenda', true).order('hora_ini') as unknown as Promise<{ data: LinhaAgenda[] | null; error: unknown }>
  let r = await ler(campos + ',excecoes')
  if (r.error) r = await ler(campos) // sem a 0033: sem dias liberados
  if (r.error) return { disponivel: false, linhas: [] }
  return { disponivel: true, linhas: r.data ?? [] }
}

/** As cores escolhidas para os tipos. Consulta à parte: sem a 0030 do banco, valem as cores padrão. */
export async function carregarCores(sb: SupabaseClient): Promise<{ disponivel: boolean; cores: CoresAgenda }> {
  const { data, error } = await sb.from('profiles').select('cores_agenda').single()
  if (error) return { disponivel: false, cores: {} }
  return { disponivel: true, cores: lerCores(data?.cores_agenda) }
}

/** Os blocos da agenda em cada dia do intervalo (o dia anterior entra para o plantão que vira a noite) e o tempo livre de cada dia. */
export async function agendaDosDias(sb: SupabaseClient, de: string, ate: string) {
  const [ag, { data: p }, { cores }] = await Promise.all([carregarAgenda(sb), sb.from('profiles').select('janela_ini,janela_fim,folga_min').single(), carregarCores(sb)])
  const ocupados: Record<string, Intervalo[]> = {}, livres: Record<string, string> = {}
  /** Só nos dias com algo na agenda: o tempo livre (min), em texto curto, e a sugestão de estudo. */
  const sugestoes: Record<string, { livre: number; texto: string; sugestao: number }> = {}
  if (!ag.disponivel || !ag.linhas.length) return { disponivel: ag.disponivel, ocupados, livres, sugestoes, linhas: ag.linhas, cores }
  const todos = ocupadosPorData(ag.linhas.map(paraCompromisso), addDays(de, -1), ate)
  const janela = janelaDoPerfil(p?.janela_ini, p?.janela_fim), folga = p?.folga_min ?? 30
  for (let d = de; d <= ate; d = addDays(d, 1)) {
    if (!todos[d]?.length) continue
    ocupados[d] = [...todos[d]].sort((a, b) => a.ini - b.ini).map(o => ({ ...o, cor: corDaCategoria(o.categoria, cores) }))
    const l = livreDoDia(ocupados[d], janela, folga)
    livres[d] = l.minutos ? `Livre: ${descreverJanelas(l.janelas)} (${formatarMinutos(l.minutos)})` : 'Sem tempo livre'
    sugestoes[d] = { livre: l.minutos, texto: l.minutos ? `${formatarMinutos(l.minutos)} livres (${descreverJanelas(l.janelas)})` : 'nenhum tempo livre', sugestao: sugestaoDeEstudo(l.minutos) }
  }
  return { disponivel: true, ocupados, livres, sugestoes, linhas: ag.linhas, cores }
}
