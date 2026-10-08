import Link from 'next/link'
import type { PrimeiroPasso } from '@/lib/engine/hoje'

/** Cartão "Comece por aqui" da tela Hoje para quem ainda não concluiu nenhuma tarefa: uma ação só, clara. */
export default function PrimeirosPassos({ passo }: { passo: PrimeiroPasso }) {
  if (!passo) return null
  const caixa = 'space-y-3 rounded-2xl border border-brand/50 bg-brand/5 p-5'
  if (passo.tipo === 'sem-assuntos') return (
    <section aria-labelledby="comece" className={caixa}>
      <h2 id="comece" className="font-display text-lg font-semibold">Comece por aqui</h2>
      <p className="text-sm text-muted">Seu plano ainda está vazio. Use o cronograma pronto do R1TMO, ajustado à data da sua prova, ou traga o seu.</p>
      <Link href="/importar" className="inline-block rounded-xl bg-brand px-5 py-2.5 font-medium text-on-cor">Montar meu plano</Link>
    </section>)
  if (passo.tipo === 'sem-plano-hoje') return (
    <section aria-labelledby="comece" className={caixa}>
      <h2 id="comece" className="font-display text-lg font-semibold">Comece por aqui</h2>
      <p className="text-sm text-muted">Você já tem assuntos, mas nada no plano de hoje. Gere o cronograma para distribuí-los pelo seu tempo.</p>
      <Link href="/cronograma" className="inline-block rounded-xl bg-brand px-5 py-2.5 font-medium text-on-cor">Gerar meu cronograma</Link>
    </section>)
  return (
    <section aria-labelledby="comece" className={caixa}>
      <p className="text-xs font-medium uppercase tracking-wide text-brand">Comece por aqui</p>
      <h2 id="comece" className="font-display text-lg font-semibold">{passo.titulo}{passo.minutos ? <span className="font-sans text-base font-normal text-muted"> · {passo.minutos} min</span> : null}</h2>
      <p className="text-sm text-muted">Estude o assunto do seu jeito (livro, aula, resumo) e marque como concluído na lista abaixo. As revisões de 1, 7, 30 e 60 dias entram sozinhas no plano.</p>
      <div className="flex flex-wrap items-center gap-3">
        <Link href={passo.href} className="rounded-xl bg-brand px-5 py-2.5 font-medium text-on-cor">Abrir o assunto</Link>
        <Link href="/banco/praticar" className="text-sm font-medium text-brand hover:underline">ou aqueça com algumas questões</Link>
      </div>
    </section>)
}
