import { redirect } from 'next/navigation'
import { atribuirAreasPorNome } from '@/lib/areas-data'
import { supabaseServer } from '@/lib/supabase/server'

const DISCIPLINAS = ['Clínica Médica', 'Cirurgia', 'Pediatria', 'Ginecologia e Obstetrícia', 'Preventiva', 'Psiquiatria']
const CORES = ['#22C55E', '#3B82F6', '#F59E0B', '#EC4899', '#A855F7', '#EF4444']
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

async function salvar(fd: FormData) {
  'use server'
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
    await sb.from('disciplines').insert(DISCIPLINAS.map((nome, i) => ({ user_id: user.id, nome, cor: CORES[i], ordem: i, peso: Number(fd.get(`peso_${i}`)) })))
    await atribuirAreasPorNome(sb, DISCIPLINAS)
  }
  redirect('/inicio')
}

export default async function Onboarding() {
  const sb = await supabaseServer()
  const [{ data: p }, { data: ds }] = await Promise.all([sb.from('profiles').select('nome').single(), sb.from('disciplines').select('id,nome,peso').order('ordem')])
  const lista = ds?.length ? ds.map(d => ({ chave: d.id as string, nome: d.nome as string, peso: d.peso as number })) : DISCIPLINAS.map((nome, i) => ({ chave: String(i), nome, peso: 3 }))
  const input = 'rounded-xl border border-line bg-bg px-3 py-2 outline-none focus:border-brand'
  return (
    <main className="mx-auto max-w-xl p-6">
      <form action={salvar} className="space-y-6 rounded-2xl border border-line bg-surface p-8">
        <div><h1 className="text-2xl font-semibold">Vamos montar seu plano</h1>
          <p className="text-sm text-muted">Com essas respostas o sistema organiza seu cronograma.</p></div>
        <label className="block space-y-1"><span className="text-sm">Seu nome</span><input name="nome" required defaultValue={p?.nome ?? ''} className={input + ' w-full'} /></label>
        <label className="block space-y-1"><span className="text-sm">Data da prova</span><input name="exam_date" type="date" required className={input} /></label>
        <div className="grid grid-cols-2 gap-4">
          <label className="space-y-1"><span className="text-sm">Horas de estudo por dia</span><input name="horas" type="number" inputMode="numeric" min={1} max={16} defaultValue={2} className={input + ' w-full'} /></label>
          <label className="space-y-1"><span className="text-sm">Questões por dia</span><input name="questoes" type="number" inputMode="numeric" min={0} defaultValue={40} className={input + ' w-full'} /></label>
        </div>
        <fieldset><legend className="mb-2 text-sm">Dias disponíveis</legend>
          <div className="flex flex-wrap gap-2">{DIAS.map((d, i) => (
            <label key={d} className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-sm has-[:checked]:border-brand has-[:checked]:text-brand">
              <input type="checkbox" name="dias" value={i} defaultChecked={i > 0} className="sr-only" />{d}</label>))}</div></fieldset>
        <fieldset><legend className="mb-2 text-sm">Peso de cada disciplina (1 a 5)</legend>
          <div className="space-y-2">{lista.map(d => (
            <label key={d.chave} className="flex items-center justify-between gap-4"><span>{d.nome}</span>
              <select name={`peso_${d.chave}`} defaultValue={d.peso} className={input}>{[1, 2, 3, 4, 5].map(n => <option key={n}>{n}</option>)}</select></label>))}</div></fieldset>
        <button className="w-full rounded-xl bg-brand py-3 font-medium text-black">Criar meu plano</button>
      </form>
    </main>
  )
}
