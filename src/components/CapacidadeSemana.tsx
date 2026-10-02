'use client'
import { useEffect, useState, useTransition } from 'react'
import { definirCapacidade, limparCapacidade, copiarSemanaAnterior } from '@/lib/capacidade'
import { OPCOES_TEMPO, formatarMinutos } from '@/lib/engine/tempo'

const NOME = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const rotulo = (d: string) => `${NOME[new Date(d + 'T12:00:00Z').getUTCDay()]} ${d.slice(8)}/${d.slice(5, 7)}`

/** Uma semana: um toque por dia para dizer quanto tempo de estudo existe. Sem horários. */
export default function CapacidadeSemana({ titulo, segunda, dias, informados, padroes }: {
  titulo: string; segunda: string; dias: string[]; informados: Record<string, number>; padroes: Record<string, number>
}) {
  const [vals, setVals] = useState(informados), [, start] = useTransition()
  useEffect(() => setVals(informados), [JSON.stringify(informados)]) // eslint-disable-line react-hooks/exhaustive-deps
  const definir = (d: string, m: number) => { setVals(v => ({ ...v, [d]: m })); start(() => definirCapacidade(d, m)) }
  const chip = (on: boolean) => `rounded-xl border px-3.5 text-sm ${on ? 'border-brand bg-brand/15 text-brand' : 'border-line'}`
  return (
    <section className="space-y-3 rounded-2xl border border-line bg-surface p-5" aria-label={titulo}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">{titulo}</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          <button type="button" onClick={() => start(() => copiarSemanaAnterior(segunda))} className="rounded-xl border border-line px-3 hover:border-brand">Copiar da semana anterior</button>
          <button type="button" onClick={() => { setVals({}); start(() => limparCapacidade(dias[0], dias[dias.length - 1])) }} className="rounded-xl border border-line px-3 hover:border-brand">Usar o padrão</button>
        </div>
      </div>
      <div className="space-y-1 border-b border-line pb-3">
        <p className="text-sm text-muted">Todos os dias</p>
        <div className="flex flex-wrap gap-2">{OPCOES_TEMPO.map(m => <button key={m} type="button" onClick={() => dias.forEach(d => definir(d, m))} className={chip(false)}>{formatarMinutos(m)}</button>)}</div>
      </div>
      {dias.map(d => {
        const informado = vals[d] !== undefined, atual = vals[d] ?? padroes[d] ?? 0
        return (
          <div key={d} className="space-y-1.5 md:flex md:items-center md:justify-between md:gap-4 md:space-y-0">
            <p className="w-28 text-sm"><span className="font-medium">{rotulo(d)}</span>{!informado && <span className="block text-xs text-muted">padrão: {formatarMinutos(atual)}</span>}</p>
            <div className="flex flex-wrap gap-2 md:justify-end">{OPCOES_TEMPO.map(m => (
              <button key={m} type="button" onClick={() => definir(d, m)} aria-pressed={informado && atual === m} className={chip(informado && atual === m)}>{formatarMinutos(m)}</button>))}</div>
          </div>)
      })}
    </section>
  )
}
