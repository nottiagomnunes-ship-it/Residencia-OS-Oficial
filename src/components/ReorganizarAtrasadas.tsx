'use client'
import { useState, useTransition } from 'react'
import { previaReorganizar, reorganizarAtrasadas, type Previa } from '@/lib/reorganizar'
import { addDays } from '@/lib/engine/review'
import { formatarMinutos } from '@/lib/engine/tempo'
import { useAvisos } from '@/components/Avisos'

const curta = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`

/** Mostra como as atrasadas seriam distribuídas pelos próximos dias e só muda depois de confirmar. */
export default function ReorganizarAtrasadas({ n }: { n: number }) {
  const [previa, setPrevia] = useState<Previa | null>(null), [pend, start] = useTransition(), { mostrar } = useAvisos()
  const rotulo = (p: Previa, d: string) => (d === p.hoje ? 'Hoje' : d === addDays(p.hoje, 1) ? 'Amanhã' : curta(d))
  const abrir = () => start(async () => setPrevia(await previaReorganizar()))
  const aplicar = () => start(async () => {
    const r = await reorganizarAtrasadas()
    setPrevia(null)
    mostrar(r.erro ? { tipo: 'erro', conteudo: r.erro } : r.movidas ? { tipo: 'ok', conteudo: `Pronto: ${r.movidas} ${r.movidas === 1 ? 'tarefa reorganizada' : 'tarefas reorganizadas'}.` } : { tipo: 'info', conteudo: 'Nada coube nos próximos dias.' })
  })
  const movel = previa ? previa.total - previa.semLugar : 0
  return (
    <div className="space-y-2 rounded-xl border border-line p-3 text-sm">
      {!previa && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p>{`Você tem ${n} ${n === 1 ? 'tarefa atrasada' : 'tarefas atrasadas'}. Posso distribuí-las pelos próximos dias, dentro do seu tempo.`}</p>
          <button onClick={abrir} disabled={pend} className="rounded-xl border border-brand px-4 py-2 text-brand disabled:opacity-60">{pend ? 'Calculando…' : 'Reorganizar atrasadas'}</button>
        </div>)}
      {previa && (movel > 0 ? (
        <>
          <p className="font-medium">Assim ficaria ({movel} de {previa.total}):</p>
          <ul className="text-muted">{previa.porDia.map(x => <li key={x.data}>• {rotulo(previa, x.data)} <span className="text-xs">({curta(x.data)})</span>: {x.qtd} {x.qtd === 1 ? 'tarefa' : 'tarefas'} · {formatarMinutos(x.min)}</li>)}</ul>
          {previa.semLugar > 0 && <p className="text-xs text-warn">{previa.semLugar} {previa.semLugar === 1 ? 'não cabe' : 'não cabem'} nos próximos 21 dias e {previa.semLugar === 1 ? 'fica' : 'ficam'} como {previa.semLugar === 1 ? 'está' : 'estão'}.</p>}
          <p className="text-xs text-muted">Dias em que você não informou o tempo usam o seu tempo padrão. As reorganizadas entram antes do que cada dia já tinha.</p>
          <div className="flex gap-2">
            <button onClick={aplicar} disabled={pend} className="rounded-xl bg-brand px-4 py-2 font-medium text-black disabled:opacity-60">{pend ? 'Aplicando…' : 'Aplicar'}</button>
            <button onClick={() => setPrevia(null)} disabled={pend} className="rounded-xl border border-line px-4 py-2">Cancelar</button>
          </div>
        </>
      ) : (
        <>
          <p>Nada das atrasadas cabe nos próximos dias com o tempo que você tem. Aumente o tempo em <a href="/semana" className="text-brand underline">Meu tempo</a> e tente de novo.</p>
          <button onClick={() => setPrevia(null)} className="rounded-xl border border-line px-4 py-2">Fechar</button>
        </>))}
    </div>)
}
