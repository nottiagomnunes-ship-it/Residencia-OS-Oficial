'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { hojeBR } from '@/lib/dates'
import { addDays } from '@/lib/engine/review'
import { weekStart } from '@/lib/engine/calendar'
import { hhmmParaMin } from '@/lib/engine/compromissos'
import { validarCompromisso, copiarEscala, lerEscalaEmTexto, ehCategoria, corPermitida, lerCores, semDuplicados } from '@/lib/engine/agenda'

async function ctx() {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  return { sb, uid: user.id }
}
const ISO = /^\d{4}-\d{2}-\d{2}$/, HORA = /^\d{2}:\d{2}$/
const SEM_SUBSTITUIR = 'Falta atualizar o banco: rode supabase/migrations/0032_substituir_agenda.sql no SQL Editor do Supabase.'
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
  const { data: iguais } = await sb.from('commitments').select('titulo,tipo,data,dias,hora_ini,hora_fim').eq('agenda', true).eq('tipo', c.tipo).ilike('titulo', c.titulo)
  if (!semDuplicados([c], (iguais ?? []) as never[]).novos.length) voltar(c.tipo === 'pontual' && c.data ? weekStart(c.data) : s, 'ok', `"${c.titulo}" já estava na agenda com esse dia e horário. Nada foi repetido.`)
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
  if (fd.get('modo') === 'substituir') {
    // a semana passa a ser exatamente a cópia da anterior (o que havia nela sai)
    const anteriores = (data ?? []).filter(p => p.data && p.data < s)
    const copia = copiarEscala(anteriores, s)
    if (!copia.length) voltar(s, 'erro', 'Nada para copiar: a semana anterior não tem horários de um dia só.')
    const { data: r, error: e3 } = await sb.rpc('substituir_agenda_semana', { p_de: s, p_ate: addDays(s, 6), p_itens: copia })
    if (e3) voltar(s, 'erro', /substituir_agenda_semana/.test(e3.message) ? SEM_SUBSTITUIR : 'Não foi possível substituir. Nada foi alterado.')
    voltar(s, 'ok', `Semana substituída: ${(r as any)?.inseridos ?? copia.length} ${copia.length === 1 ? 'horário copiado' : 'horários copiados'} da semana anterior (${(r as any)?.removidos ?? 0} removidos).`)
  }
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

/** Texto rápido da escala ("seg 7-13 Enfermaria; ter 19-7 PS"): grava tudo de uma vez, como horários de um dia só. */
export async function salvarEscalaRapida(fd: FormData) {
  const { sb, uid } = await ctx()
  const s = semana(fd)
  const { itens, erros } = lerEscalaEmTexto(String(fd.get('texto') ?? '').slice(0, 5000), s)
  if (!itens.length) voltar(s, 'erro', erros[0] ?? 'Escreva pelo menos um horário, por exemplo: seg 7-13 Enfermaria.')
  const validos = itens.slice(0, 100).flatMap(i => { const v = validarCompromisso({ ...i, tipo: 'pontual' }); return v.ok ? [v.c] : [] })
  const naoEntendidas = erros.length ? ` ${erros.length} ${erros.length === 1 ? 'linha não foi entendida' : 'linhas não foram entendidas'}: ${erros[0]}` : ''
  const fim = addDays(s, 6)
  if (fd.get('modo') === 'substituir') {
    // os horários de um dia só DESTA semana saem; os novos desta semana entram no lugar (tudo ou nada). Datas fora da semana são só adicionadas.
    const naSemana = semDuplicados(validos.filter(c => c.data! >= s && c.data! <= fim), []).novos, fora = validos.filter(c => c.data! < s || c.data! > fim)
    const { data: r, error } = await sb.rpc('substituir_agenda_semana', { p_de: s, p_ate: fim, p_itens: naSemana })
    if (error) voltar(s, 'erro', /substituir_agenda_semana/.test(error.message) ? SEM_SUBSTITUIR : 'Não foi possível substituir. Nada foi alterado.')
    let extra = 0
    if (fora.length) {
      const { data: ex } = await sb.from('commitments').select('titulo,tipo,data,dias,hora_ini,hora_fim').eq('agenda', true).eq('tipo', 'pontual').in('data', [...new Set(fora.map(c => c.data!))])
      const add = semDuplicados(fora, (ex ?? []) as never[]).novos
      if (add.length && !(await sb.from('commitments').insert(add.map(c => ({ ...c, user_id: uid, agenda: true })))).error) extra = add.length
    }
    voltar(s, erros.length ? 'erro' : 'ok', `Escala da semana substituída: ${(r as any)?.removidos ?? 0} ${((r as any)?.removidos ?? 0) === 1 ? 'horário removido' : 'horários removidos'} e ${naSemana.length + extra} adicionados.${naoEntendidas}`)
  }
  const datas = [...new Set(validos.map(c => c.data!))]
  const { data: ex } = datas.length ? await sb.from('commitments').select('titulo,tipo,data,dias,hora_ini,hora_fim').eq('agenda', true).eq('tipo', 'pontual').in('data', datas) : { data: [] }
  const { novos, repetidos } = semDuplicados(validos, (ex ?? []) as never[])
  if (!novos.length) voltar(s, 'ok', `Tudo isso já estava na agenda. Nada foi repetido.${naoEntendidas}`)
  const { error } = await sb.from('commitments').insert(novos.map(c => ({ ...c, user_id: uid, agenda: true })))
  if (error) voltar(s, 'erro', /agenda|categoria/.test(error.message) ? SEM_CAMPOS : 'Não foi possível salvar. Nada foi gravado.')
  voltar(s, erros.length ? 'erro' : 'ok', `${novos.length} ${novos.length === 1 ? 'horário adicionado' : 'horários adicionados'} à agenda.${repetidos ? ` ${repetidos} já ${repetidos === 1 ? 'existia' : 'existiam'} e não ${repetidos === 1 ? 'foi repetido' : 'foram repetidos'}.` : ''}${naoEntendidas}`)
}

/** Escolhe a cor de um tipo da agenda (da paleta). Chamado pela tela, sem recarregar a página. */
export async function definirCorDaCategoria(categoria: string, cor: string): Promise<{ ok: boolean; erro?: string }> {
  const { sb, uid } = await ctx()
  if (!ehCategoria(categoria) || !corPermitida(cor)) return { ok: false }
  const { data, error } = await sb.from('profiles').select('cores_agenda').single()
  if (error) return { ok: false, erro: 'Falta atualizar o banco: rode supabase/migrations/0030_cores_da_agenda.sql no SQL Editor do Supabase.' }
  const cores = { ...lerCores(data?.cores_agenda), [categoria]: cor.toUpperCase() }
  const { error: e2 } = await sb.from('profiles').update({ cores_agenda: cores }).eq('id', uid)
  if (e2) return { ok: false }
  ;['/agenda', '/calendario', '/cronograma'].forEach(p => revalidatePath(p))
  return { ok: true }
}
/** Volta todas as cores da agenda ao padrão. */
export async function restaurarCoresDaAgenda(): Promise<{ ok: boolean }> {
  const { sb, uid } = await ctx()
  const { error } = await sb.from('profiles').update({ cores_agenda: {} }).eq('id', uid)
  ;['/agenda', '/calendario', '/cronograma'].forEach(p => revalidatePath(p))
  return { ok: !error }
}
