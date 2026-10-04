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

/**
 * Apagar tudo: a conta volta a ser como recém-criada (o login e a senha continuam). Apaga, numa transação só, os dados de todas as tabelas
 * e volta o perfil ao padrão; depois tira as figuras das provas e do banco de questões do armazenamento. Exige digitar APAGAR TUDO.
 */
export async function apagarTudo(fd: FormData) {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  if (String(fd.get('confirmacao') || '').trim().toUpperCase().replace(/\s+/g, ' ') !== 'APAGAR TUDO')
    redirect('/configuracoes?erro=' + encodeURIComponent('Nada foi apagado. Para apagar tudo, digite APAGAR TUDO no campo de confirmação.'))
  const { error } = await sb.rpc('apagar_tudo')
  if (error) redirect('/configuracoes?erro=' + encodeURIComponent(/apagar_tudo/.test(error.message) ? 'Falta atualizar o banco: rode supabase/migrations/0036_apagar_tudo.sql no SQL Editor do Supabase. Nada foi apagado.' : 'Não foi possível apagar. Nada foi apagado; tente de novo.'))
  await apagarFiguras(sb, user.id).catch(() => {})
  revalidatePath('/', 'layout')
  redirect('/onboarding')
}

/** As figuras ficam em <id da pessoa>/<id da prova ou "banco">/arquivo no armazenamento "provas". */
async function apagarFiguras(sb: Awaited<ReturnType<typeof supabaseServer>>, uid: string) {
  const st = sb.storage.from('provas')
  const { data: pastas } = await st.list(uid, { limit: 1000 })
  for (const p of pastas ?? []) {
    for (let pagina = 0; pagina < 50; pagina++) {
      const { data: arquivos } = await st.list(`${uid}/${p.name}`, { limit: 1000 })
      if (!arquivos?.length) break
      await st.remove(arquivos.map(a => `${uid}/${p.name}/${a.name}`))
      if (arquivos.length < 1000) break
    }
  }
}
