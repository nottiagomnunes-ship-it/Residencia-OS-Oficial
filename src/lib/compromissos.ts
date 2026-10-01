'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { hhmmParaMin } from '@/lib/engine/compromissos'

async function ctx() {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  return { sb, uid: user.id }
}
const HORA = /^\d{2}:\d{2}$/, ISO = /^\d{4}-\d{2}-\d{2}$/
const voltar = (p: string) => { revalidatePath('/semana'); redirect(p) }
const erro = (m: string) => redirect('/semana?erro=' + encodeURIComponent(m))

/** Com data preenchida o compromisso é pontual (um dia só); sem data, é semanal nos dias marcados. */
export async function criarCompromisso(fd: FormData) {
  const { sb, uid } = await ctx()
  const titulo = String(fd.get('titulo') || '').trim().slice(0, 80), ini = String(fd.get('hora_ini')), fim = String(fd.get('hora_fim'))
  const data = String(fd.get('data') || ''), dias = fd.getAll('dias').map(Number).filter(n => n >= 0 && n <= 6)
  const de = String(fd.get('valido_de') || ''), ate = String(fd.get('valido_ate') || '')
  if (!titulo) erro('Dê um nome ao compromisso (por exemplo, "Internato" ou "Plantão").')
  if (!HORA.test(ini) || !HORA.test(fim) || ini === fim) erro('Informe horário de início e de fim diferentes. Se o fim for menor que o início, o horário vira a noite (ex.: 19:00 às 07:00).')
  if (data && !ISO.test(data)) erro('Data inválida.')
  if (!data && !dias.length) erro('Marque os dias da semana ou escolha uma data.')
  await sb.from('commitments').insert({ user_id: uid, titulo, tipo: data ? 'pontual' : 'semanal', dias: data ? [] : dias, data: data || null,
    hora_ini: ini, hora_fim: fim, valido_de: ISO.test(de) ? de : null, valido_ate: ISO.test(ate) ? ate : null })
  voltar('/semana?ok=1')
}
export async function excluirCompromisso(fd: FormData) {
  const { sb } = await ctx()
  await sb.from('commitments').delete().eq('id', String(fd.get('id')))
  voltar('/semana')
}
export async function salvarJanela(fd: FormData) {
  const { sb, uid } = await ctx()
  const ini = String(fd.get('janela_ini')), fim = String(fd.get('janela_fim')), folga = Number(fd.get('folga_min'))
  if (!HORA.test(ini) || !HORA.test(fim) || hhmmParaMin(ini) >= hhmmParaMin(fim)) erro('A janela de estudo precisa começar antes de terminar (ex.: 06:00 às 23:00).')
  if (!(folga >= 0 && folga <= 180)) erro('A folga de deslocamento deve ficar entre 0 e 180 minutos.')
  await sb.from('profiles').update({ janela_ini: ini, janela_fim: fim, folga_min: folga }).eq('id', uid)
  voltar('/semana?ok=1')
}
