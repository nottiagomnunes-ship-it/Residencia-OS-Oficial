'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { previaRecalcular, recalcularRota, type PreviaRota } from '@/lib/recalcular'
import { useAvisos } from '@/components/Avisos'

const curta = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`
const pl = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/** Linhas da prévia: o que acontece com cada tipo de atrasada e até quando vai o plano. */
export function linhasDaPrevia(p: Extract<PreviaRota, { ok: true }>) {
  const l: string[] = []
  if (p.assuntos) l.push(`${pl(p.assuntos, 'assunto atrasado volta', 'assuntos atrasados voltam')} para o plano a partir de hoje.`)
  if (p.revisoes) l.push(`${pl(p.revisoes, 'revisão atrasada vai', 'revisões atrasadas vão')} para os próximos dias${p.ateRevisoes ? ` (até ${curta(p.ateRevisoes)})` : ''}, as mais antigas primeiro.`)
  if (p.revisoesSemLugar) l.push(`${pl(p.revisoesSemLugar, 'revisão não cabe', 'revisões não cabem')} nos próximos 21 dias e ${p.revisoesSemLugar === 1 ? 'fica atrasada' : 'ficam atrasadas'}.`)
  if (p.descartar) l.push(`${pl(p.descartar, 'bloco de questões de dias passados sai', 'blocos de questões de dias passados saem')} (as questões de hoje em diante continuam).`)
  if (p.ficam) l.push(`${pl(p.ficam, 'tarefa que você criou fica', 'tarefas que você criou ficam')} como ${p.ficam === 1 ? 'está' : 'estão'}.`)
  l.push(p.fim)
  return l
}

/** "Recalcular rota": mostra a prévia e só muda o plano depois de confirmar. */
export default function RecalcularRota({ n, texto }: { n?: number; texto?: string }) {
  const [previa, setPrevia] = useState<PreviaRota | null>(null), [pend, start] = useTransition(), { mostrar } = useAvisos(), router = useRouter()
  const abrir = () => start(async () => setPrevia(await previaRecalcular()))
  const aplicar = () => start(async () => {
    const r = await recalcularRota()
    setPrevia(null)
    mostrar({ tipo: r.ok ? 'ok' : 'erro', conteudo: r.msg })
    router.refresh()
  })
  const chamada = texto ?? (n ? `Você tem ${pl(n, 'tarefa atrasada', 'tarefas atrasadas')}. Posso refazer o plano a partir de hoje, com elas dentro.` : 'Refaz o plano a partir de hoje, trazendo de volta o que ficou para trás.')
  return (
    <div className="space-y-2 rounded-xl border border-line p-3 text-sm">
      {!previa && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p>{chamada}</p>
          <button onClick={abrir} disabled={pend} className="rounded-xl border border-brand px-4 py-2 text-brand disabled:opacity-60">{pend ? 'Calculando…' : 'Recalcular rota'}</button>
        </div>)}
      {previa && (previa.ok ? (
        <>
          <p className="font-medium">Assim ficaria:</p>
          <ul className="space-y-0.5 text-muted">{linhasDaPrevia(previa).map(x => <li key={x}>• {x}</li>)}</ul>
          {previa.avisos.length > 0 && <p className="text-xs text-warn">{previa.avisos.join(' ')}</p>}
          <p className="text-xs text-muted">Nada muda até você tocar em Aplicar. Revisões, tarefas concluídas e o que você criou à mão não são apagados.</p>
          <div className="flex gap-2">
            <button onClick={aplicar} disabled={pend} className="rounded-xl bg-brand px-4 py-2 font-medium text-on-cor disabled:opacity-60">{pend ? 'Aplicando…' : 'Aplicar'}</button>
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
