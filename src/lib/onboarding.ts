'use server'
import { redirect } from 'next/navigation'
import { atribuirAreasPorNome } from '@/lib/areas-data'
import { supabaseServer } from '@/lib/supabase/server'
import { importarCronograma } from '@/lib/importar'
import { planejarCronograma } from '@/lib/schedule'
import { CRONOGRAMA_PADRAO, ajustarAoPrazo } from '@/lib/engine/cronograma-padrao'
import { hojeBR } from '@/lib/dates'
import { lerComeco, DISCIPLINAS_PADRAO, type Comeco } from '@/lib/engine/comeco'

const CORES = ['#22C55E', '#3B82F6', '#F59E0B', '#EC4899', '#A855F7', '#EF4444']

/** Salva o assistente inicial e, numa conta sem assuntos, começa como a pessoa escolheu (cronograma pronto, importar ou vazio). */
export async function salvarOnboarding(fd: FormData) {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  await sb.from('profiles').update({
    nome: String(fd.get('nome')), exam_date: String(fd.get('exam_date')),
    daily_minutes: Number(fd.get('horas')) * 60, daily_questions_goal: Number(fd.get('questoes')),
    available_weekdays: fd.getAll('dias').map(Number), onboarded: true,
  }).eq('id', user.id)
  // Nunca apaga disciplinas (isso levaria os assuntos junto): se já existem, só atualiza os pesos; se não, cria as padrão.
  const { data: ja } = await sb.from('disciplines').select('id')
  if (ja?.length) {
    for (const d of ja) { const v = Number(fd.get(`peso_${d.id}`)); if (v >= 1 && v <= 5) await sb.from('disciplines').update({ peso: v }).eq('id', d.id) }
  } else {
    await sb.from('disciplines').insert(DISCIPLINAS_PADRAO.map((nome, i) => ({ user_id: user.id, nome, cor: CORES[i], ordem: i, peso: Number(fd.get(`peso_${i}`)) })))
    await atribuirAreasPorNome(sb, [...DISCIPLINAS_PADRAO])
  }
  // Como começar: só para quem ainda não tem assuntos (refazer o assistente nunca mexe num plano que já existe).
  const { count } = await sb.from('topics').select('id', { count: 'exact', head: true })
  const comeco: Comeco = (count ?? 0) > 0 ? 'vazio' : lerComeco(fd.get('comeco'))
  if (comeco === 'importar') redirect('/importar')
  if (comeco === 'pronto') {
    // mesmo caminho da importação; "substituir" tira as disciplinas padrão que ficarem vazias (ex.: Clínica Médica, já que o cronograma usa as especialidades)
    // com a prova antes das 66 semanas, junta semanas para caber (deixando o último mês para revisão)
    const imp = await importarCronograma(ajustarAoPrazo(CRONOGRAMA_PADRAO, hojeBR(), String(fd.get('exam_date') || '')), true)
    if (!imp.ok) redirect('/importar?erro=' + encodeURIComponent('Não foi possível carregar o cronograma pronto. Tente de novo por aqui.'))
    const plano = await planejarCronograma()
    if (!plano.ok) redirect('/cronograma?msg=' + encodeURIComponent(plano.msg))
  }
  redirect('/inicio')
}
