import { supabaseServer } from '@/lib/supabase/server'
import { NOME_CRONOGRAMA_PADRAO } from '@/lib/engine/cronograma-padrao'
import { DISCIPLINAS_PADRAO as DISCIPLINAS, type Comeco } from '@/lib/engine/comeco'
import { salvarOnboarding as salvar } from '@/lib/onboarding'
import BotaoEnviar from '@/components/BotaoEnviar'

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const OPCOES: { valor: Comeco; titulo: string; texto: string }[] = [
  { valor: 'pronto', titulo: `Usar o ${NOME_CRONOGRAMA_PADRAO}`, texto: '199 assuntos das grandes áreas, alternando as áreas e ajustados à data da sua prova. O plano já sai montado; dá para trocar pelo seu depois, sem perder o que estudou.' },
  { valor: 'importar', titulo: 'Importar o meu cronograma', texto: 'Cole o texto ou envie o PDF do cronograma que você já usa (cursinho ou o seu).' },
  { valor: 'vazio', titulo: 'Começar vazio', texto: 'Você adiciona os assuntos depois, em Matérias.' },
]


export default async function Onboarding() {
  const sb = await supabaseServer()
  const [{ data: p }, { data: ds }, { count: nAssuntos }] = await Promise.all([sb.from('profiles').select('nome').single(), sb.from('disciplines').select('id,nome,peso').order('ordem'),
    sb.from('topics').select('id', { count: 'exact', head: true })])
  const escolher = !nAssuntos // conta nova (sem assuntos): escolhe como começar
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
        {escolher && <fieldset><legend className="mb-2 text-sm">Como quer começar?</legend>
          <div className="space-y-2">{OPCOES.map(o => (
            <label key={o.valor} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 has-[:checked]:border-brand has-[:checked]:bg-brand/5">
              <input type="radio" name="comeco" value={o.valor} defaultChecked={o.valor === 'pronto'} className="mt-1 accent-brand" />
              <span><span className="block font-medium">{o.titulo}</span><span className="block text-sm text-muted">{o.texto}</span></span></label>))}</div></fieldset>}
        <BotaoEnviar enviando="Montando seu plano…" className="w-full rounded-xl bg-brand py-3 font-medium text-on-cor">Criar meu plano</BotaoEnviar>
      </form>
    </main>
  )
}
