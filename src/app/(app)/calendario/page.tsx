import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import { hojeBR } from '@/lib/dates'
import { addDays } from '@/lib/engine/review'
import { ocupadosPorData, paraCompromisso } from '@/lib/engine/compromissos'
import { diasDaVisao, mover, type Visao } from '@/lib/engine/calendar'
import NovaTarefa from '@/components/NovaTarefa'
import { carregarModelos } from '@/lib/etapas-data'
import type { Etapa } from '@/lib/engine/etapas'
import CalendarBoard, { type Item } from '@/components/CalendarBoard'
import { inputCls } from '@/components/ui'

export default async function Calendario({ searchParams }: { searchParams: Promise<{ v?: string; d?: string }> }) {
  const sp = await searchParams, hoje = hojeBR()
  const v: Visao = sp.v === 'dia' || sp.v === 'mes' ? sp.v : 'semana'
  const ancora = /^\d{4}-\d{2}-\d{2}$/.test(sp.d ?? '') ? sp.d! : hoje
  const dias = diasDaVisao(v, ancora)
  const sb = await supabaseServer()
  const { data } = await sb.from('schedule_items').select('id,tipo,titulo,data,hora_ini,hora_fim,duracao_min,qtd_questoes,status,origem,review_id,topic_id')
    .gte('data', dias[0]).lte('data', dias[dias.length - 1]).order('hora_ini', { nullsFirst: false }).order('titulo')
  const { data: cm } = await sb.from('commitments').select('*')
  const comTopico = new Set((data ?? []).map((i: any) => i.topic_id).filter(Boolean))
  const [{ data: et }, modelos] = await Promise.all([
    sb.from('topic_tasks').select('id,topic_id,tipo,titulo,qtd_questoes,concluida').order('ordem').order('created_at').limit(5000), carregarModelos(sb),
  ])
  const etapas: Record<string, Etapa[]> = {}
  for (const e of et ?? []) if (comTopico.has(e.topic_id)) (etapas[e.topic_id] ??= []).push(e as Etapa)
  const ocupados = ocupadosPorData((cm ?? []).map(paraCompromisso), addDays(dias[0], -1), dias[dias.length - 1])
  const link = (view: string, d: string) => `/calendario?v=${view}&d=${d}`
  const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Date(d + 'T12:00:00Z').toLocaleDateString('pt-BR', { ...o, timeZone: 'UTC' })
  const titulo = v === 'mes' ? fmt(ancora, { month: 'long', year: 'numeric' }) : v === 'dia' ? fmt(ancora, { weekday: 'long', day: 'numeric', month: 'long' })
    : `${fmt(dias[0], { day: '2-digit', month: '2-digit' })} a ${fmt(dias[6], { day: '2-digit', month: '2-digit' })}`
  const btn = 'rounded-lg border border-line px-3 py-1.5 text-sm hover:border-brand'
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold capitalize">{titulo}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={link(v, mover(v, ancora, -1))} className={btn} aria-label="Anterior">‹</Link>
          <Link href={link(v, hoje)} className={btn}>Hoje</Link>
          <Link href={link(v, mover(v, ancora, 1))} className={btn} aria-label="Próximo">›</Link>
          {(['dia', 'semana', 'mes'] as const).map(x => <Link key={x} href={link(x, ancora)} className={`${btn} ${x === v ? 'border-brand text-brand' : ''}`}>{x === 'mes' ? 'Mês' : x[0].toUpperCase() + x.slice(1)}</Link>)}
        </div>
      </div>
      <NovaTarefa ancora={ancora} />
      <CalendarBoard items={(data ?? []) as Item[]} dias={dias} view={v} hoje={hoje} mes={ancora.slice(0, 7)} ocupados={ocupados} etapas={etapas} modelos={modelos} />
      <p className="text-xs text-muted">Os blocos em cinza são seus compromissos (cadastrados em Minha semana). No computador, arraste uma tarefa para outro dia. No celular, toque na tarefa e use “Mover para esta data”.</p>
    </div>
  )
}
