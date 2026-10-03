import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays } from './engine/review'
import { ocupadosPorData, paraCompromisso, type Intervalo } from './engine/compromissos'
import { janelaDoPerfil, livreDoDia, descreverJanelas, duracaoCurta } from './engine/agenda'

export type LinhaAgenda = { id: string; titulo: string; categoria: string; tipo: 'semanal' | 'pontual'; dias: number[]; data: string | null; hora_ini: string; hora_fim: string; valido_de: string | null; valido_ate: string | null }

/**
 * A agenda pessoal. Consulta SEPARADA de propósito: sem a atualização 0029 do banco (campos "agenda" e "categoria"), `disponivel` vem falso e
 * as telas seguem como antes, sem quebrar.
 */
export async function carregarAgenda(sb: SupabaseClient): Promise<{ disponivel: boolean; linhas: LinhaAgenda[] }> {
  const { data, error } = await sb.from('commitments').select('id,titulo,categoria,tipo,dias,data,hora_ini,hora_fim,valido_de,valido_ate').eq('agenda', true).order('hora_ini')
  if (error) return { disponivel: false, linhas: [] }
  return { disponivel: true, linhas: (data ?? []) as LinhaAgenda[] }
}

/** Os blocos da agenda em cada dia do intervalo (o dia anterior entra para o plantão que vira a noite) e o tempo livre de cada dia. */
export async function agendaDosDias(sb: SupabaseClient, de: string, ate: string) {
  const [ag, { data: p }] = await Promise.all([carregarAgenda(sb), sb.from('profiles').select('janela_ini,janela_fim,folga_min').single()])
  const ocupados: Record<string, Intervalo[]> = {}, livres: Record<string, string> = {}
  if (!ag.disponivel || !ag.linhas.length) return { disponivel: ag.disponivel, ocupados, livres, linhas: ag.linhas }
  const todos = ocupadosPorData(ag.linhas.map(paraCompromisso), addDays(de, -1), ate)
  const janela = janelaDoPerfil(p?.janela_ini, p?.janela_fim), folga = p?.folga_min ?? 30
  for (let d = de; d <= ate; d = addDays(d, 1)) {
    if (!todos[d]?.length) continue
    ocupados[d] = [...todos[d]].sort((a, b) => a.ini - b.ini)
    const l = livreDoDia(ocupados[d], janela, folga)
    livres[d] = l.minutos ? `Livre: ${descreverJanelas(l.janelas)} (${duracaoCurta(l.minutos)})` : 'Sem tempo livre'
  }
  return { disponivel: true, ocupados, livres, linhas: ag.linhas }
}
