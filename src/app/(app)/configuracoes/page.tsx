import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import { salvarConfiguracoes, reiniciarConfiguracoes, sair } from '@/lib/config'
import { inputCls } from '@/components/ui'

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default async function Configuracoes({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { ok, erro } = await searchParams
  const { data: p } = await (await supabaseServer()).from('profiles').select('*').single()
  const Campo = ({ t, dica, children }: { t: string; dica?: string; children: React.ReactNode }) => <label className="block space-y-1"><span className="text-sm">{t}</span>{children}{dica && <span className="block text-xs text-muted">{dica}</span>}</label>
  const sec = 'space-y-4 rounded-2xl border border-line bg-surface p-5'
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Configurações</h1>
      {ok && <p role="status" className="rounded-xl border border-brand/40 bg-brand/10 p-4 text-sm">Configurações salvas. Para aplicar a nova rotina ao plano, <Link href="/cronograma" className="text-brand underline">gere o cronograma novamente</Link>.</p>}
      {erro && <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger">{erro}</p>}
      <form action={salvarConfiguracoes} className="space-y-6">
        <section className={sec}><h2 className="font-medium">Prova e rotina</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo t="Seu nome"><input name="nome" defaultValue={p?.nome ?? ''} className={inputCls + ' w-full'} /></Campo>
            <Campo t="Data da prova"><input name="exam_date" type="date" required defaultValue={p?.exam_date ?? ''} className={inputCls + ' w-full'} /></Campo>
            <Campo t="Horas de estudo por dia"><input name="horas" type="number" min={1} max={16} step={0.5} defaultValue={(p?.daily_minutes ?? 240) / 60} className={inputCls + ' w-full'} /></Campo>
            <Campo t="Questões por dia"><input name="questoes" type="number" min={0} max={500} defaultValue={p?.daily_questions_goal ?? 40} className={inputCls + ' w-full'} /></Campo>
          </div>
          <fieldset><legend className="mb-2 text-sm">Dias disponíveis</legend><div className="flex flex-wrap gap-2">{DIAS.map((d, i) => (
            <label key={d} className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-sm has-[:checked]:border-brand has-[:checked]:text-brand">
              <input type="checkbox" name="dias" value={i} defaultChecked={(p?.available_weekdays ?? []).includes(i)} className="sr-only" />{d}</label>))}</div></fieldset>
        </section>
        <section className={sec}><h2 className="font-medium">Revisão espaçada</h2>
          <Campo t="Intervalos (em dias)" dica="Vale para os próximos conteúdos concluídos; revisões já geradas não mudam."><input name="intervalos" defaultValue={(p?.review_intervals ?? [1, 7, 30, 60]).join(', ')} className={inputCls + ' w-full'} /></Campo>
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="adaptive" defaultChecked={p?.adaptive_reviews ?? true} className="mt-1 accent-brand" />
            <span>Ajustar os intervalos pelo meu desempenho<span className="block text-xs text-muted">Acerto abaixo de 60% ou dificuldade alta encurta a próxima revisão; 80% ou mais alonga.</span></span></label>
        </section>
        <section className={sec}><h2 className="font-medium">Limites de desempenho</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo t="Acerto mínimo aceitável (%)" dica="Abaixo disso o assunto ou a disciplina pede atenção."><input name="limite_foco" type="number" min={1} max={100} defaultValue={p?.limite_foco ?? 65} className={inputCls + ' w-full'} /></Campo>
            <Campo t="Questões mínimas para avaliar um assunto" dica="Evita julgar por amostra pequena."><input name="min_questoes" type="number" min={1} max={100} defaultValue={p?.min_questoes ?? 10} className={inputCls + ' w-full'} /></Campo>
          </div>
        </section>
        <button className="rounded-xl bg-brand px-5 py-2.5 font-medium text-black">Salvar configurações</button>
      </form>
      <section className={sec}><h2 className="font-medium">Disciplinas e conteúdos</h2>
        <p className="text-sm text-muted">Pesos, novas disciplinas e o catálogo de assuntos ficam em <Link href="/disciplinas" className="text-brand underline">Disciplinas</Link> e <Link href="/conteudos" className="text-brand underline">Conteúdos</Link>. Para trazer o seu próprio plano, em texto ou PDF, use <Link href="/importar" className="text-brand underline">Importar cronograma</Link>.</p></section>
      <section className={sec}><h2 className="font-medium">Meus dados</h2>
        <p className="text-sm text-muted">Baixe uma cópia do que você registrou. O backup completo guarda tudo; as planilhas abrem direto no Excel.</p>
        <div className="flex flex-wrap gap-2 text-sm">
          <a href="/exportar/backup" className="rounded-xl bg-brand px-4 py-2 font-medium text-black">Baixar backup completo (.json)</a>
          {[['assuntos', 'Assuntos'], ['questoes', 'Questões'], ['erros', 'Caderno de erros'], ['simulados', 'Simulados']].map(([k, n]) => (
            <a key={k} href={`/exportar/${k}`} className="rounded-xl border border-line px-4 py-2 hover:border-brand">{n} (.csv)</a>))}
        </div>
        <p className="text-xs text-muted">Guarde o backup em um lugar seguro: ele contém todo o seu histórico de estudo.</p></section>
      <section className={sec}><h2 className="font-medium">Instalar no celular</h2>
        <p className="text-sm text-muted">O app abre em tela cheia, com ícone na tela inicial, como um aplicativo.</p>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li><b>Android (Chrome):</b> menu ⋮ → <i>Instalar aplicativo</i> (ou <i>Adicionar à tela inicial</i>).</li>
          <li><b>iPhone (Safari):</b> botão Compartilhar → <i>Adicionar à Tela de Início</i>.</li>
        </ul></section>
      <details className="rounded-2xl border border-danger/40 bg-surface p-5">
        <summary className="cursor-pointer font-medium text-danger">Reiniciar configurações</summary>
        <form action={reiniciarConfiguracoes} className="mt-4 space-y-4 text-sm">
          <p className="text-muted">Volta a data da prova, a rotina, os dias disponíveis, os intervalos de revisão, os limites de desempenho e a janela de estudo para os valores padrão, e leva você ao assistente inicial para configurar tudo de novo.</p>
          <p>Não são apagados: assuntos, disciplinas, questões, simulados, erros, revisões, tarefas do calendário, XP e conquistas. O cronograma já gerado continua; gere-o de novo depois de reconfigurar.</p>
          <label className="flex items-start gap-3"><input type="checkbox" name="metas" defaultChecked className="mt-1 accent-brand" /><span>Apagar também as minhas metas</span></label>
          <label className="flex items-start gap-3"><input type="checkbox" name="compromissos" defaultChecked className="mt-1 accent-brand" /><span>Apagar também os meus compromissos de Minha semana</span></label>
          <label className="block space-y-1"><span>Digite <b>REINICIAR</b> para confirmar</span><input name="confirmacao" autoComplete="off" className={inputCls + ' w-full'} /></label>
          <button className="rounded-xl border border-danger px-4 py-2 font-medium text-danger hover:bg-danger/10">Reiniciar configurações</button>
        </form>
      </details>
      <form action={sair}><button className="rounded-xl border border-line px-4 py-2 text-sm hover:border-danger hover:text-danger">Sair da conta</button></form>
    </div>
  )
}
