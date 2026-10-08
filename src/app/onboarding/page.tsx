import { supabaseServer } from '@/lib/supabase/server'
import { NOME_CRONOGRAMA_PADRAO } from '@/lib/engine/cronograma-padrao'
import { nomeInicial, estimarProva, type Comeco } from '@/lib/engine/comeco'
import { hojeBR } from '@/lib/dates'
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
  const [{ data: p }, { count: nAssuntos }, { data: { user } }] = await Promise.all([sb.from('profiles').select('nome,exam_date').single(),
    sb.from('topics').select('id', { count: 'exact', head: true }), sb.auth.getUser()])
  const escolher = !nAssuntos // conta nova (sem assuntos): escolhe como começar
  const nome = nomeInicial(p?.nome, user?.user_metadata) // quem entrou pelo Google já chega com o nome
  const estimativa = estimarProva(hojeBR()).split('-').reverse().join('/') // dd/mm/aaaa
  const input = 'rounded-xl border border-line bg-bg px-3 py-2 outline-none focus:border-brand'
  return (
    <main className="mx-auto max-w-xl p-6">
      <form action={salvar} className="space-y-6 rounded-2xl border border-line bg-surface p-8">
        <div><h1 className="text-2xl font-semibold">Vamos montar seu plano</h1>
          <p className="text-sm text-muted">Quatro respostas rápidas. Tudo dá para mudar depois em Configurações.</p></div>
        <label className="block space-y-1"><span className="text-sm">Seu nome</span><input name="nome" required defaultValue={nome} autoComplete="given-name" className={input + ' w-full'} /></label>
        <fieldset className="space-y-2"><legend className="text-sm">Data da prova</legend>
          <input name="exam_date" type="date" aria-label="Data da prova" defaultValue={p?.exam_date ?? ''} className={input} />
          <label className="flex items-start gap-2 text-sm text-muted"><input type="checkbox" name="prova_nao_sei" value="1" className="mt-1 accent-brand" />
            <span>Ainda não sei: usar {estimativa} por enquanto</span></label></fieldset>
        <label className="block space-y-1"><span className="text-sm">Quanto tempo você costuma ter para estudar num dia comum?</span>
          <select name="horas" defaultValue="2" className={input}>{[['0.5', '30 min'], ['1', '1 h'], ['1.5', '1 h 30'], ['2', '2 h'], ['3', '3 h'], ['4', '4 h'], ['6', '6 h']].map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
          <span className="block text-xs text-muted">É só o ponto de partida: na tela Hoje você diz quanto tem em cada dia.</span></label>
        <fieldset><legend className="mb-2 text-sm">Em que dias você estuda?</legend>
          <div className="flex flex-wrap gap-2">{DIAS.map((d, i) => (
            <label key={d} className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-sm has-[:checked]:border-brand has-[:checked]:text-brand">
              <input type="checkbox" name="dias" value={i} defaultChecked={i > 0} className="sr-only" />{d}</label>))}</div></fieldset>
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
