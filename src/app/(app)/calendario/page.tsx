import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import { hojeBR } from '@/lib/dates'
import { addDays } from '@/lib/engine/review'
import { agendaDosDias } from '@/lib/agenda-data'
import { diasDaVisao, mover, type Visao } from '@/lib/engine/calendar'
import NovaTarefa from '@/components/NovaTarefa'
import { carregarModelos } from '@/lib/etapas-data'
import { etapasDasRevisoes } from '@/lib/revisao-etapas-data'
import type { Etapa } from '@/lib/engine/etapas'
import CalendarBoard, { type Item } from '@/components/CalendarBoard'
import { inputCls } from '@/components/ui'

export default async function Calendario({ searchParams }: { searchParams: Promise<{ v?: string; d?: string }> }) {
  const sp = await searchParams, hoje = hojeBR()
  const v: Visao = sp.v === 'dia' || sp.v === 'mes' ? sp.v : 'semana'
  const ancora = /^\d{4}-\d{2}-\d{2}$/.test(sp.d ?? '') ? sp.d! : hoje
  const dias = diasDaVisao(v, ancora)
  const sb = await supabaseServer()
  // as tarefas, as etapas, os modelos e a agenda ao mesmo tempo; só as etapas das revisões dependem das tarefas
  const [{ data }, { data: et }, modelos, { ocupados, livres }] = await Promise.all([
    sb.from('schedule_items').select('id,tipo,titulo,data,hora_ini,hora_fim,duracao_min,qtd_questoes,status,origem,review_id,topic_id')
      .gte('data', dias[0]).lte('data', dias[dias.length - 1]).order('hora_ini', { nullsFirst: false }).order('ordem_dia', { nullsFirst: false }).order('titulo'),
    sb.from('topic_tasks').select('id,topic_id,tipo,titulo,qtd_questoes,concluida').order('ordem').order('created_at').limit(5000), carregarModelos(sb),
    agendaDosDias(sb, dias[0], dias[dias.length - 1]), // agenda pessoal (internato, academia...): só aparece junto, com o tempo livre do dia
  ])
  const comTopico = new Set((data ?? []).map((i: any) => i.topic_id).filter(Boolean))
  const etapasRev = await etapasDasRevisoes(sb, (data ?? []).filter((i: any) => i.review_id && i.status !== 'concluido').map((i: any) => i.review_id))
  const etapas: Record<string, Etapa[]> = {}
  for (const e of et ?? []) if (comTopico.has(e.topic_id)) (etapas[e.topic_id] ??= []).push(e as Etapa)
  const link = (view: string, d: string) => `/calendario?v=${view}&d=${d}`
  const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Date(d + 'T12:00:00Z').toLocaleDateString('pt-BR', { ...o, timeZone: 'UTC' })
  const titulo = v === 'mes' ? fmt(ancora, { month: 'long', year: 'numeric' }) : v === 'dia' ? fmt(ancora, { weekday: 'long', day: 'numeric', month: 'long' })
    : `${fmt(dias[0], { day: '2-digit', month: '2-digit' })} a ${fmt(dias[6], { day: '2-digit', month: '2-digit' })}`
  const btn = 'rounded-lg border border-line px-4 py-2 text-sm hover:border-brand'
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold first-letter:uppercase">{titulo}</h1>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link href={link(v, mover(v, ancora, -1))} className={btn} aria-label="Anterior">‹</Link>
            <Link href={link(v, hoje)} className={btn}>Hoje</Link>
            <Link href={link(v, mover(v, ancora, 1))} className={btn} aria-label="Próximo">›</Link>
          </div>
          <nav aria-label="Visão do calendário" className="grid grid-cols-3 overflow-hidden rounded-xl border border-line text-sm">
            {(['dia', 'semana', 'mes'] as const).map(x => <Link key={x} href={link(x, ancora)} aria-current={x === v ? 'page' : undefined}
              className={`px-4 py-2.5 text-center ${x === v ? 'bg-brand/15 text-brand' : 'hover:bg-line/40'}`}>{x === 'mes' ? 'Mês' : x[0].toUpperCase() + x.slice(1)}</Link>)}
          </nav>
        </div>
      </div>
      <NovaTarefa ancora={ancora} />
      <CalendarBoard items={(data ?? []) as Item[]} dias={dias} view={v} hoje={hoje} mes={ancora.slice(0, 7)} ocupados={ocupados} livres={livres} etapas={etapas} etapasRev={etapasRev} modelos={modelos} />
      <p className="text-xs text-muted">No computador, arraste uma tarefa para outro dia. No celular, toque na tarefa e use “Mover para esta data”. Internato, academia e compromissos (com o tempo livre do dia) vêm da <Link href="/agenda" className="text-brand underline">Compromissos</Link>.</p>
    </div>
  )
}
