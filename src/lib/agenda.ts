'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { hojeBR } from '@/lib/dates'
import { addDays } from '@/lib/engine/review'
import { weekStart } from '@/lib/engine/calendar'
import { hhmmParaMin } from '@/lib/engine/compromissos'
import { validarCompromisso, copiarEscala } from '@/lib/engine/agenda'

async function ctx() {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  return { sb, uid: user.id }
}
const ISO = /^\d{4}-\d{2}-\d{2}$/, HORA = /^\d{2}:\d{2}$/
const SEM_CAMPOS = 'Falta atualizar o banco: rode supabase/migrations/0029_agenda_pessoal.sql no SQL Editor do Supabase.'
const semana = (fd: FormData) => { const s = String(fd.get('semana') || ''); return ISO.test(s) ? weekStart(s) : weekStart(hojeBR()) }
const voltar = (s: string, k: 'ok' | 'erro', m: string): never => {
  ;['/agenda', '/calendario', '/cronograma', '/semana'].forEach(p => revalidatePath(p))
  redirect(`/agenda?s=${s}&${k}=${encodeURIComponent(m)}`)
}

export async function criarNaAgenda(fd: FormData) {
  const { sb, uid } = await ctx()
  const s = semana(fd)
  const v = validarCompromisso({ titulo: fd.get('titulo'), categoria: fd.get('categoria'), tipo: fd.get('tipo'), dias: fd.getAll('dias'), data: fd.get('data'),
    hora_ini: fd.get('hora_ini'), hora_fim: fd.get('hora_fim'), valido_de: fd.get('valido_de'), valido_ate: fd.get('valido_ate') })
  if (!v.ok) voltar(s, 'erro', v.erro)
  const { c } = v as Extract<typeof v, { ok: true }>
  const { error } = await sb.from('commitments').insert({ user_id: uid, ...c, agenda: true })
  if (error) voltar(s, 'erro', /agenda|categoria/.test(error.message) ? SEM_CAMPOS : 'Não foi possível salvar. Tente de novo.')
  voltar(c.tipo === 'pontual' && c.data ? weekStart(c.data) : s, 'ok', `"${c.titulo}" adicionado à agenda.`)
}

export async function excluirDaAgenda(fd: FormData) {
  const { sb } = await ctx()
  await sb.from('commitments').delete().eq('id', String(fd.get('id'))).eq('agenda', true)
  voltar(semana(fd), 'ok', 'Removido da agenda.')
}

/** Um horário de "toda semana" para de se repetir a partir de hoje (o que já passou continua no histórico). */
export async function pararDeRepetir(fd: FormData) {
  const { sb } = await ctx()
  const id = String(fd.get('id')), ontem = addDays(hojeBR(), -1)
  const { data: c } = await sb.from('commitments').select('valido_de').eq('id', id).eq('agenda', true).maybeSingle()
  if (!c) voltar(semana(fd), 'erro', 'Horário não encontrado.')
  if (c!.valido_de && c!.valido_de > ontem) await sb.from('commitments').delete().eq('id', id)
  else await sb.from('commitments').update({ valido_ate: ontem }).eq('id', id)
  voltar(semana(fd), 'ok', 'Não se repete mais a partir de hoje.')
}

/** Copia os horários de "um dia só" da semana anterior para esta semana (a escala do internato muda toda semana). */
export async function copiarEscalaAnterior(fd: FormData) {
  const { sb, uid } = await ctx()
  const s = semana(fd)
  const { data, error } = await sb.from('commitments').select('titulo,categoria,tipo,data,hora_ini,hora_fim').eq('agenda', true).eq('tipo', 'pontual')
    .gte('data', addDays(s, -7)).lte('data', addDays(s, 6))
  if (error) voltar(s, 'erro', SEM_CAMPOS)
  const novos = copiarEscala(data ?? [], s)
  if (!novos.length) voltar(s, 'erro', 'Nada para copiar: a semana anterior não tem horários de um dia só (ou eles já estão nesta semana).')
  const { error: e2 } = await sb.from('commitments').insert(novos.map(n => ({ ...n, user_id: uid, agenda: true })))
  if (e2) voltar(s, 'erro', 'Não foi possível copiar. Nada foi gravado.')
  voltar(s, 'ok', `${novos.length} ${novos.length === 1 ? 'horário copiado' : 'horários copiados'} da semana anterior.`)
}

/** Traz para a agenda os horários cadastrados no modelo antigo de "Minha semana". */
export async function trazerHorariosAntigos(fd: FormData) {
  const { sb } = await ctx()
  const { error } = await sb.from('commitments').update({ agenda: true }).eq('agenda', false)
  if (error) voltar(semana(fd), 'erro', SEM_CAMPOS)
  voltar(semana(fd), 'ok', 'Horários antigos trazidos para a agenda. Confira e apague o que não vale mais.')
}

/** Em que parte do dia você está disponível (para calcular o tempo livre) e a folga de deslocamento em volta de cada compromisso. */
export async function salvarJanelaDoDia(fd: FormData) {
  const { sb, uid } = await ctx()
  const s = semana(fd), ini = String(fd.get('janela_ini')).slice(0, 5), fim = String(fd.get('janela_fim')).slice(0, 5), folga = Number(fd.get('folga_min'))
  if (!HORA.test(ini) || !HORA.test(fim) || hhmmParaMin(ini) >= hhmmParaMin(fim)) voltar(s, 'erro', 'O dia precisa começar antes de terminar (ex.: 06:00 às 23:00).')
  if (!Number.isInteger(folga) || folga < 0 || folga > 180) voltar(s, 'erro', 'A folga deve ficar entre 0 e 180 minutos.')
  await sb.from('profiles').update({ janela_ini: ini, janela_fim: fim, folga_min: folga }).eq('id', uid)
  voltar(s, 'ok', 'Horário do dia salvo.')
}
