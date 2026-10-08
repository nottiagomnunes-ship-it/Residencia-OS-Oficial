'use server'
import { redirect } from 'next/navigation'
import { atribuirAreasPorNome } from '@/lib/areas-data'
import { supabaseServer } from '@/lib/supabase/server'
import { importarCronograma } from '@/lib/importar'
import { planejarCronograma } from '@/lib/schedule'
import { CRONOGRAMA_PADRAO } from '@/lib/engine/cronograma-padrao'
import { hojeBR } from '@/lib/dates'
import { lerComeco, dataDaProva, DISCIPLINAS_PADRAO, type Comeco } from '@/lib/engine/comeco'

const CORES = ['#22C55E', '#3B82F6', '#F59E0B', '#EC4899', '#A855F7', '#EF4444']

/** Salva o assistente inicial e, numa conta sem assuntos, começa como a pessoa escolheu (cronograma pronto, importar ou vazio). */
export async function salvarOnboarding(fd: FormData) {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  // Assistente curto: nome, prova (ou "ainda não sei"), tempo de um dia comum e dias da semana. Questões por dia e pesos ficam no padrão
  // e mudam depois em Configurações e em Matérias.
  const prova = dataDaProva(fd.get('exam_date'), fd.get('prova_nao_sei') === '1', hojeBR())
  const horas = Number(fd.get('horas')), dias = fd.getAll('dias').map(Number).filter(d => d >= 0 && d <= 6)
  await sb.from('profiles').update({
    nome: String(fd.get('nome') || '').trim().slice(0, 80), exam_date: prova.data,
    daily_minutes: (horas >= 0.5 && horas <= 16 ? horas : 2) * 60,
    available_weekdays: dias.length ? dias : [1, 2, 3, 4, 5, 6], onboarded: true,
  }).eq('id', user.id)
  // Nunca apaga disciplinas (isso levaria os assuntos junto) nem mexe nos pesos de quem já tem; numa conta nova, cria as padrão com peso 3.
  const { data: ja } = await sb.from('disciplines').select('id')
  if (!ja?.length) {
    await sb.from('disciplines').insert(DISCIPLINAS_PADRAO.map((nome, i) => ({ user_id: user.id, nome, cor: CORES[i], ordem: i, peso: 3 })))
    await atribuirAreasPorNome(sb, [...DISCIPLINAS_PADRAO])
  }
  // Como começar: só para quem ainda não tem assuntos (refazer o assistente nunca mexe num plano que já existe).
  const { count } = await sb.from('topics').select('id', { count: 'exact', head: true })
  const comeco: Comeco = (count ?? 0) > 0 ? 'vazio' : lerComeco(fd.get('comeco'))
  if (comeco === 'importar') redirect('/importar')
  if (comeco === 'pronto') {
    // mesmo caminho da importação; "substituir" tira as disciplinas padrão que ficarem vazias (ex.: Clínica Médica, já que o cronograma usa as especialidades)
    // entra com as 66 semanas originais: quem ajusta ao prazo é o gerador, com a data da prova de cada vez (mudar a data e gerar de novo refaz o ritmo)
    const imp = await importarCronograma(CRONOGRAMA_PADRAO, true)
    if (!imp.ok) redirect('/importar?erro=' + encodeURIComponent('Não foi possível carregar o cronograma pronto. Tente de novo por aqui.'))
    const plano = await planejarCronograma()
    if (!plano.ok) redirect('/cronograma?msg=' + encodeURIComponent(plano.msg))
  }
  redirect('/inicio')
}
