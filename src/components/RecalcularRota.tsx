'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { desfazerRecalculo, previaRecalcular, recalcularRota, type PreviaRota } from '@/lib/recalcular'
import type { Modo } from '@/lib/engine/recalcular'
import { useAvisos } from '@/components/Avisos'

type Ok = Extract<PreviaRota, { ok: true }>
const curta = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`
const pl = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/** Linhas da prévia da rota equilibrada: o que acontece com cada tipo de atrasada e até quando vai o plano. */
export function linhasDaPrevia(e: Ok['equilibrada']) {
  const l: string[] = []
  if (e.assuntos) l.push(`${pl(e.assuntos, 'assunto atrasado volta', 'assuntos atrasados voltam')} para o plano a partir de hoje.`)
  if (e.revisoes) l.push(`${pl(e.revisoes, 'revisão atrasada vai', 'revisões atrasadas vão')} para os próximos dias${e.ateRevisoes ? ` (até ${curta(e.ateRevisoes)})` : ''}, as mais antigas primeiro.`)
  if (e.revisoesSemLugar) l.push(`${pl(e.revisoesSemLugar, 'revisão não cabe', 'revisões não cabem')} nos próximos 21 dias e ${e.revisoesSemLugar === 1 ? 'fica atrasada' : 'ficam atrasadas'}.`)
  if (e.descartar) l.push(`${pl(e.descartar, 'bloco de questões de dias passados sai', 'blocos de questões de dias passados saem')} (as questões de hoje em diante continuam).`)
  if (e.ficam) l.push(`${pl(e.ficam, 'tarefa que você criou fica', 'tarefas que você criou ficam')} como ${e.ficam === 1 ? 'está' : 'estão'}.`)
  l.push(e.fim)
  return l
}

/** Linhas da prévia da rota leve. */
export function linhasDaLeve(v: Ok['leve']) {
  if (!v.total) return ['Não há tarefas atrasadas: o plano fica como está.']
  if (!v.movidas) return ['Nada das atrasadas cabe no tempo que sobra nos próximos 21 dias. A rota equilibrada refaz o plano para elas caberem.']
  const l = [`${pl(v.movidas, 'tarefa atrasada é encaixada', 'tarefas atrasadas são encaixadas')} no tempo que sobra${v.ate ? ` até ${curta(v.ate)}` : ''}, sem mexer no resto do plano.`]
  if (v.semLugar) l.push(`${pl(v.semLugar, 'não cabe e continua atrasada', 'não cabem e continuam atrasadas')}.`)
  return l
}

/** "Viabilidade": das horas de assunto que faltam, quantas cabem até a prova. */
export function Viabilidade({ v }: { v: Ok['viab'] }) {
  const cor = v.pct >= 100 ? 'bg-brand' : v.pct >= 80 ? 'bg-warn' : 'bg-danger'
  return (
    <div className="space-y-1 rounded-lg bg-surface p-2">
      <p className="text-xs text-muted">Viabilidade do cronograma</p>
      <div className="h-2 overflow-hidden rounded-full bg-line"><div className={`h-full ${cor}`} style={{ width: `${Math.min(100, v.pct)}%` }} /></div>
      <p>{v.pct >= 100 ? `Cabe tudo: as ${v.necessarioH} h de assuntos que faltam cabem no seu tempo até a prova.` : `Cabem ${v.cabeH} h das ${v.necessarioH} h de assuntos que faltam (${v.pct}%). Faltam cerca de ${v.faltaH} h: informe mais tempo em "Meu tempo", libere mais dias ou tire assuntos de baixa prioridade.`}</p>
    </div>)
}

/** Avisa e oferece "Desfazer" depois de um recálculo. */
export function useDesfazer() {
  const { mostrar } = useAvisos(), router = useRouter()
  return () => desfazerRecalculo().then(r => { mostrar({ tipo: r.ok ? 'ok' : 'erro', conteudo: r.msg }); router.refresh() })
}

/** "Recalcular rota": mostra a prévia das duas rotas e só muda o plano depois de confirmar. */
export default function RecalcularRota({ n }: { n?: number }) {
  const [previa, setPrevia] = useState<PreviaRota | null>(null), [modo, setModo] = useState<Modo>('equilibrada'), [pend, start] = useTransition()
  const { mostrar } = useAvisos(), router = useRouter(), desfazer = useDesfazer()
  const abrir = () => start(async () => { setModo('equilibrada'); setPrevia(await previaRecalcular()) })
  const aplicar = () => start(async () => {
    const r = await recalcularRota(modo)
    setPrevia(null)
    mostrar({ tipo: r.ok ? 'ok' : 'erro', conteudo: r.msg, ...(r.desfazer ? { acao: { rotulo: 'Desfazer', fazer: desfazer }, duracao: 20000 } : {}) })
    router.refresh()
  })
  const chamada = n ? `Você tem ${pl(n, 'tarefa atrasada', 'tarefas atrasadas')}. Posso recalcular a rota a partir de hoje, com elas dentro.` : 'Refaz o plano a partir de hoje e mostra se o que falta cabe até a prova.'
  const botao = (m: Modo, titulo: string, sub: string) => (
    <button type="button" onClick={() => setModo(m)} aria-pressed={modo === m} className={`flex-1 rounded-xl border px-3 py-2 text-left ${modo === m ? 'border-brand bg-brand/10' : 'border-line'}`}>
      <span className="block font-medium">{titulo}</span><span className="block text-xs text-muted">{sub}</span>
    </button>)
  return (
    <div className="space-y-2 rounded-xl border border-line p-3 text-sm">
      {!previa && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p>{chamada}</p>
          <button onClick={abrir} disabled={pend} className="rounded-xl border border-brand px-4 py-2 text-brand disabled:opacity-60">{pend ? 'Calculando…' : 'Recalcular rota'}</button>
        </div>)}
      {previa && (previa.ok ? (
        <>
          <Viabilidade v={previa.viab} />
          <p className="font-medium">Como quer recuperar?</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            {botao('equilibrada', 'Equilibrada (recomendada)', 'Refaz o plano a partir de hoje com as atrasadas dentro.')}
            {botao('leve', 'Leve', 'Mantém o plano e encaixa as atrasadas só no tempo que sobra.')}
          </div>
          <p className="font-medium">Assim ficaria:</p>
          <ul className="space-y-0.5 text-muted">{(modo === 'equilibrada' ? linhasDaPrevia(previa.equilibrada) : linhasDaLeve(previa.leve)).map(x => <li key={x}>• {x}</li>)}</ul>
          {modo === 'equilibrada' && previa.avisos.length > 0 && <p className="text-xs text-warn">{previa.avisos.join(' ')}</p>}
          <p className="text-xs text-muted">Nada muda até você tocar em Aplicar, e dá para desfazer por 7 dias (enquanto você não concluir tarefas do plano novo). Revisões, tarefas concluídas e o que você criou à mão não são apagados.</p>
          <div className="flex gap-2">
            <button onClick={aplicar} disabled={pend || (modo === 'leve' && !previa.leve.movidas)} className="rounded-xl bg-brand px-4 py-2 font-medium text-on-cor disabled:opacity-60">{pend ? 'Aplicando…' : 'Aplicar'}</button>
            <button onClick={() => setPrevia(null)} disabled={pend} className="rounded-xl border border-line px-4 py-2">Cancelar</button>
          </div>
        </>
      ) : (
        <>
          <p>{previa.msg}</p>
          <button onClick={() => setPrevia(null)} className="rounded-xl border border-line px-4 py-2">Fechar</button>
        </>))}
    </div>)
}

/** No Plano: lembra que o último recálculo ainda pode ser desfeito. */
export function DesfazerRecalculo({ quando }: { quando: string }) {
  const [pend, start] = useTransition(), desfazer = useDesfazer()
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3 text-sm">
      <p>Você recalculou a rota em {quando}. Se preferir o plano de antes, dá para desfazer.</p>
      <button onClick={() => start(desfazer)} disabled={pend} className="rounded-xl border border-line px-4 py-2 disabled:opacity-60">{pend ? 'Desfazendo…' : 'Desfazer recálculo'}</button>
    </div>)
}
