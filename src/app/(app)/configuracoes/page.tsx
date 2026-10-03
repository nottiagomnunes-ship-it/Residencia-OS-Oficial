import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import { salvarConfiguracoes, reiniciarConfiguracoes, sair } from '@/lib/config'
import { salvarLembrete, enviarLembreteTeste } from '@/lib/lembretes'
import { salvarRitmoModo } from '@/lib/config'
import { inputCls } from '@/components/ui'
import RestaurarBackup from '@/components/RestaurarBackup'
import TamanhoTexto from '@/components/TamanhoTexto'
import AvisoDaUrl from '@/components/AvisoDaUrl'
import { cookies } from 'next/headers'
import { lerTamanho } from '@/lib/engine/texto'
import { carregarInfoRestauracao } from '@/lib/backup-restauracao-data'

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default async function Configuracoes({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string; aviso?: string }> }) {
  const { ok, erro, aviso } = await searchParams
  const sb = await supabaseServer()
  const { data: p } = await sb.from('profiles').select('*').single()
  const restauracao = await carregarInfoRestauracao(sb)
  const tamanhoTexto = lerTamanho((await cookies()).get('texto')?.value)
  const Campo = ({ t, dica, children }: { t: string; dica?: string; children: React.ReactNode }) => <label className="block space-y-1"><span className="text-sm">{t}</span>{children}{dica && <span className="block text-xs text-muted">{dica}</span>}</label>
  const sec = 'space-y-4 rounded-2xl border border-line bg-surface p-5'
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Configurações</h1>
      {ok && <AvisoDaUrl tipo="ok" chaves={['ok']}>Configurações salvas. Para aplicar a nova rotina ao plano, <Link href="/cronograma" className="text-brand underline">gere o cronograma novamente</Link>.</AvisoDaUrl>}
      {aviso && <AvisoDaUrl tipo="ok" chaves={['aviso']}>{aviso}</AvisoDaUrl>}
      {erro && <AvisoDaUrl tipo="erro" chaves={['erro']}>{erro}</AvisoDaUrl>}
      <form action={salvarConfiguracoes} className="space-y-6">
        <section className={sec}><h2 className="font-medium">Prova e rotina</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo t="Seu nome"><input name="nome" defaultValue={p?.nome ?? ''} className={inputCls + ' w-full'} /></Campo>
            <Campo t="Data da prova"><input name="exam_date" type="date" required defaultValue={p?.exam_date ?? ''} className={inputCls + ' w-full'} /></Campo>
            <Campo t="Tempo padrão de estudo por dia (horas)" dica="Vale quando você não informa o tempo da semana em Minha semana."><input name="horas" type="number" min={1} max={16} step={0.5} defaultValue={(p?.daily_minutes ?? 240) / 60} className={inputCls + ' w-full'} /></Campo>
            <Campo t="Questões por dia"><input name="questoes" type="number" inputMode="numeric" min={0} max={500} defaultValue={p?.daily_questions_goal ?? 40} className={inputCls + ' w-full'} /></Campo>
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
            <Campo t="Acerto mínimo aceitável (%)" dica="Abaixo disso o assunto ou a disciplina pede atenção."><input name="limite_foco" type="number" inputMode="numeric" min={1} max={100} defaultValue={p?.limite_foco ?? 65} className={inputCls + ' w-full'} /></Campo>
            <Campo t="Questões mínimas para avaliar um assunto" dica="Evita julgar por amostra pequena."><input name="min_questoes" type="number" inputMode="numeric" min={1} max={100} defaultValue={p?.min_questoes ?? 10} className={inputCls + ' w-full'} /></Campo>
          </div>
        </section>
        <button className="rounded-xl bg-brand px-5 py-2.5 font-medium text-black">Salvar configurações</button>
      </form>
      <section className={sec}><h2 className="font-medium">Disciplinas e conteúdos</h2>
        <p className="text-sm text-muted">Pesos, novas disciplinas e o catálogo de assuntos ficam em <Link href="/disciplinas" className="text-brand underline">Disciplinas</Link> e <Link href="/conteudos" className="text-brand underline">Conteúdos</Link>. Para trazer o seu próprio plano, em texto ou PDF, use <Link href="/importar" className="text-brand underline">Importar cronograma</Link>.</p></section>
      <section className={sec}><h2 className="font-medium">Aparência</h2>
        <p className="text-sm text-muted">Tamanho do texto em todo o app. Se as letras estiverem pequenas no tablet, experimente Grande ou Maior.</p>
        <TamanhoTexto inicial={tamanhoTexto} />
      </section>
      <section className={sec}><h2 className="font-medium">Ritmo para a prova</h2>
        <p className="text-sm text-muted">Compara quantos assuntos você conclui por semana com o necessário para chegar à prova. É uma referência, não uma cobrança: escolha o quanto quer ver.</p>
        <form action={salvarRitmoModo} className="space-y-3">
          {[['resumo', 'Só um resumo no Início', 'Uma linha discreta ("Prova em 71 dias · 60 assuntos restantes"). O ritmo completo fica no Cronograma.'],
            ['completo', 'Completo no Início', 'Mostra também no Início a meta da semana e a projeção.'],
            ['oculto', 'Ocultar', 'Não mostra o ritmo em lugar nenhum.']].map(([v, t, d]) => (
            <label key={v} className="flex items-start gap-3 text-sm"><input type="radio" name="ritmo_modo" value={v} defaultChecked={(p?.ritmo_modo ?? 'resumo') === v} className="mt-1 accent-brand" />
              <span><span className="font-medium">{t}</span><span className="block text-muted">{d}</span></span></label>))}
          <button className="rounded-xl border border-line px-4 py-2 text-sm hover:border-brand">Salvar</button>
        </form>
      </section>
      <section className={sec}><h2 className="font-medium">Lembretes por e-mail</h2>
        <p className="text-sm text-muted">Todo dia, por volta das 7h (horário de Brasília), você recebe um resumo com as revisões e as tarefas do dia. Se o dia estiver livre, nenhum e-mail é enviado.</p>
        {!process.env.RESEND_API_KEY?.trim() && <p className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm">O envio de e-mails ainda não foi configurado no servidor (veja o final do DEPLOY.md). <Link href="/diagnostico" className="underline">Ver diagnóstico</Link></p>}
        {p?.lembrete_aviso && <p role="status" className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm">{p.lembrete_aviso}</p>}
        {!process.env.EMAIL_FROM && <p className="text-xs text-muted">Enquanto o app usar o envio de e-mails gratuito (modo de teste), o lembrete só funciona para o e-mail do administrador.</p>}
        <form action={salvarLembrete} className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="ativo" defaultChecked={!!p?.lembrete_email} className="accent-brand" />Receber o resumo diário por e-mail</label>
          <button className="rounded-xl border border-line px-4 py-2 text-sm hover:border-brand">Salvar</button>
        </form>
        <form action={enviarLembreteTeste}><button className="text-sm text-brand underline">Enviar um e-mail de teste agora</button></form>
      </section>
      <section className={sec}><h2 className="font-medium">Meus dados</h2>
        <p className="text-sm text-muted">Baixe uma cópia do que você registrou. O backup completo guarda tudo; as planilhas abrem direto no Excel.</p>
        <div className="flex flex-wrap gap-2 text-sm">
          <a href="/exportar/backup" className="rounded-xl bg-brand px-4 py-2 font-medium text-black">Baixar backup completo (.json)</a>
          {[['assuntos', 'Assuntos'], ['questoes', 'Questões'], ['erros', 'Caderno de erros'], ['simulados', 'Simulados']].map(([k, n]) => (
            <a key={k} href={`/exportar/${k}`} className="rounded-xl border border-line px-4 py-2 hover:border-brand">{n} (.csv)</a>))}
        </div>
        <p className="text-xs text-muted">Guarde o backup em um lugar seguro: ele contém todo o seu histórico de estudo.</p></section>
      <section className={sec}><h2 className="font-medium">Restaurar backup</h2>
        <RestaurarBackup disponivel={restauracao.disponivel} desfazerEm={restauracao.criadoEm} />
      </section>
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
