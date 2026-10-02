'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { CONFIG_PADRAO, parseIntervalos } from '@/lib/engine/config'
import { hojeBR } from '@/lib/dates'

export async function salvarConfiguracoes(fd: FormData) {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  const intervalos = parseIntervalos(String(fd.get('intervalos')))
  const dias = fd.getAll('dias').map(Number).filter(n => n >= 0 && n <= 6)
  const horas = Number(fd.get('horas')), questoes = Number(fd.get('questoes')), limite = Number(fd.get('limite_foco')), minimo = Number(fd.get('min_questoes'))
  const prova = String(fd.get('exam_date'))
  const erro = !intervalos ? 'Intervalos inválidos: use números de 1 a 365 separados por vírgula, por exemplo 1, 7, 30, 60.'
    : !dias.length ? 'Escolha pelo menos um dia da semana.' : !(horas >= 1 && horas <= 16) ? 'Horas por dia: entre 1 e 16.'
    : !(questoes >= 0 && questoes <= 500) ? 'Questões por dia: entre 0 e 500.' : !(limite >= 1 && limite <= 100 && minimo >= 1 && minimo <= 100) ? 'Os limites de desempenho devem ficar entre 1 e 100.'
    : !/^\d{4}-\d{2}-\d{2}$/.test(prova) ? 'Informe a data da prova.' : null
  if (erro) redirect('/configuracoes?erro=' + encodeURIComponent(erro))
  await sb.from('profiles').update({
    nome: String(fd.get('nome') || '').trim() || null, exam_date: prova, daily_minutes: Math.round(horas * 60), daily_questions_goal: questoes,
    available_weekdays: dias, review_intervals: intervalos, adaptive_reviews: fd.get('adaptive') === 'on', limite_foco: limite, min_questoes: minimo,
  }).eq('id', user.id)
  ;['/configuracoes', '/inicio', '/cronograma', '/desempenho', '/revisoes'].forEach(p => revalidatePath(p, 'layout'))
  redirect('/configuracoes?ok=1')
}
/** Como mostrar o ritmo para a prova. Ação própria, para não interferir no salvamento das demais configurações. */
export async function salvarRitmoModo(fd: FormData) {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  const modo = String(fd.get('ritmo_modo'))
  if (!['completo', 'resumo', 'oculto'].includes(modo)) redirect('/configuracoes?erro=' + encodeURIComponent('Escolha uma das opções do ritmo.'))
  const { error } = await sb.from('profiles').update({ ritmo_modo: modo }).eq('id', user.id)
  if (error) redirect('/configuracoes?erro=' + encodeURIComponent('Não foi possível salvar essa opção. Tente de novo.'))
  ;['/configuracoes', '/inicio', '/cronograma'].forEach(x => revalidatePath(x, 'layout'))
  redirect('/configuracoes?ok=1')
}
export async function sair() {
  const sb = await supabaseServer()
  await sb.auth.signOut()
  redirect('/login')
}

/** Volta as configurações ao padrão e reabre o assistente inicial. Não apaga estudo, questões, erros, conquistas nem XP. */
export async function reiniciarConfiguracoes(fd: FormData) {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  if (String(fd.get('confirmacao') || '').trim().toUpperCase() !== 'REINICIAR')
    redirect('/configuracoes?erro=' + encodeURIComponent('Para reiniciar, digite REINICIAR no campo de confirmação.'))
  await sb.from('profiles').update({ ...CONFIG_PADRAO, study_start_date: hojeBR(), onboarded: false }).eq('id', user.id)
  if (fd.get('metas') === 'on') await sb.from('goals').delete().eq('user_id', user.id)
  if (fd.get('compromissos') === 'on') await sb.from('commitments').delete().eq('user_id', user.id)
  revalidatePath('/', 'layout')
  redirect('/onboarding')
}
