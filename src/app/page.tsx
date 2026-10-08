import type { Metadata } from 'next'
import Link from 'next/link'
import Marca from '@/components/Marca'

// Página inicial pública (r1tmo.com.br). Quem já entrou nem chega a vê-la: o middleware leva para Hoje.
export const metadata: Metadata = {
  title: 'R1TMO · Estudos para residência médica no ritmo do seu dia',
  description: 'Diga quanto tempo você tem hoje: o R1TMO mostra o que cabe, agenda as revisões e traz de volta as questões que você errou. Feito para quem estuda para a residência durante o internato.',
}

const RECURSOS = [
  { titulo: 'Sem horário de relógio', texto: 'A escala muda toda semana? Você diz quanto tempo tem em cada dia e o plano se ajusta. Atrasou, reorganiza com uma prévia antes de mudar.' },
  { titulo: 'Revisões automáticas', texto: 'Concluiu um assunto, as revisões de 1, 7, 30 e 60 dias entram sozinhas no plano, e os intervalos podem se ajustar ao seu acerto.' },
  { titulo: 'Questões e provas', texto: 'Banco de questões por banca, assunto e ano, provas inteiras e um modo de praticar uma por vez, com o gabarito na hora.' },
  { titulo: 'Erros que voltam', texto: 'O que você erra vai para o caderno de erros e volta para refazer em 1, 7 e 30 dias, até fixar.' },
  { titulo: 'Agenda do internato', texto: 'Plantões, ambulatório e academia ficam na agenda, separados do estudo, e servem para sugerir quanto dá para estudar em cada dia.' },
  { titulo: 'Onde focar', texto: 'O desempenho mostra onde você está perdendo pontos e o que vale priorizar.' },
] as const

/** Um pedaço da tela Hoje, só para mostrar a ideia (não usa dados de ninguém). */
function Exemplo() {
  const tarefas = [
    { tipo: 'Revisão D7', nome: 'Insuficiência cardíaca', tempo: '25 min', cor: 'text-info' },
    { tipo: 'Estudo', nome: 'Pré-eclâmpsia', tempo: '50 min', cor: 'text-brand' },
    { tipo: 'Questões', nome: '15 de Pediatria', tempo: '30 min', cor: 'text-violet' },
  ]
  return (
    <div aria-hidden className="w-full max-w-sm rounded-2xl border border-line bg-surface p-5 shadow-[0_20px_60px_-30px_rgba(47,210,127,0.35)]">
      <p className="text-sm text-muted">Quanto tempo você tem hoje?</p>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {['30 min', '1 h', '2 h', '3 h'].map(t => (
          <span key={t} className={`rounded-xl border px-3 py-1.5 ${t === '2 h' ? 'border-brand bg-brand/10 text-brand' : 'border-line'}`}>{t}</span>))}
      </div>
      <p className="mt-5 text-sm font-medium text-info">Para fazer hoje (1 h 45 de 2 h)</p>
      <ul className="mt-2 divide-y divide-line">
        {tarefas.map(t => (
          <li key={t.nome} className="flex items-center gap-3 py-2.5">
            <span className="size-4 shrink-0 rounded-full border-2 border-line" />
            <span className="min-w-0 flex-1"><span className={`block text-xs ${t.cor}`}>{t.tipo}</span><span className="block truncate">{t.nome}</span></span>
            <span className="text-sm text-muted">{t.tempo}</span>
          </li>))}
      </ul>
    </div>)
}

export default function Inicial() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Marca />
        <Link href="/login" className="rounded-xl border border-line px-4 py-2 text-sm font-medium hover:border-brand">Entrar</Link>
      </header>

      <main>
        <section className="mx-auto grid max-w-5xl items-center gap-12 px-5 pb-16 pt-8 sm:px-8 md:grid-cols-[1.15fr_1fr] md:pt-16">
          <div className="space-y-6">
            <p className="inline-block rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-xs font-medium text-brand">Para quem estuda para a residência durante o internato</p>
            <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">Estude no ritmo do seu dia, não do cronograma ideal.</h1>
            <p className="max-w-xl text-lg text-muted">Diga quanto tempo você tem hoje. O R1TMO mostra só o que cabe, agenda as revisões sozinho e traz de volta as questões que você errou.</p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/cadastro" className="rounded-xl bg-brand px-6 py-3 font-medium text-on-cor">Criar conta</Link>
              <Link href="/login" className="rounded-xl px-4 py-3 font-medium text-brand hover:underline">Já tenho conta</Link>
            </div>
            <p className="text-sm text-muted">Funciona no navegador e pode ser instalado na tela inicial do celular.</p>
          </div>
          <div className="flex justify-center md:justify-end"><Exemplo /></div>
        </section>

        <section aria-labelledby="como" className="border-t border-line bg-surface/40">
          <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8">
            <h2 id="como" className="text-2xl font-semibold">O que o R1TMO faz por você</h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {RECURSOS.map(r => (
                <li key={r.titulo} className="rounded-2xl border border-line bg-bg p-5">
                  <h3 className="font-display font-semibold">{r.titulo}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{r.texto}</p>
                </li>))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-5 py-16 sm:px-8">
          <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
            <h2 className="text-xl font-semibold">Em fase de testes</h2>
            <p className="mt-2 max-w-2xl text-muted">O R1TMO está sendo testado por estudantes de medicina. Encontrou um problema ou tem uma ideia? Dentro do app, em Sugestões, a mensagem chega direto para quem desenvolve.</p>
            <Link href="/cadastro" className="mt-5 inline-block rounded-xl bg-brand px-6 py-3 font-medium text-on-cor">Criar minha conta</Link>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-6 text-sm text-muted sm:px-8">
        <Marca tamanho="sm" />
        <p><Link href="/termos" className="underline hover:text-brand">Termos de uso</Link> · <Link href="/privacidade" className="underline hover:text-brand">Privacidade</Link></p>
      </footer>
    </div>)
}
