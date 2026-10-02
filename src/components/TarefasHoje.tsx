'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { concluirItem } from '@/lib/calendar'
import { definirCapacidade } from '@/lib/capacidade'
import { resumoHoje } from '@/lib/engine/hoje'
import { dividirPorTempo, escolherAdiantar, formatarMinutos, OPCOES_TEMPO } from '@/lib/engine/tempo'
import { diffDays } from '@/lib/engine/review'
import { Bar, fmtData } from '@/components/ui'
import { adiantarTarefas } from '@/lib/reorganizar'
import ReorganizarAtrasadas from '@/components/ReorganizarAtrasadas'

type T = { id: string; tipo: string; titulo: string; data: string; hora_ini: string | null; hora_fim: string | null; duracao_min: number | null; topic_id: string | null; qtd_questoes: number | null }
type Adiantavel = { id: string; titulo: string; data: string; duracao_min: number | null }
const TIPO: Record<string, string> = { estudo: 'Estudo', revisao: 'Revisão', questoes: 'Questões', flashcards: 'Flashcards', simulado: 'Simulado' }

/** O que fazer hoje, conforme o tempo informado: mostra o que cabe (atrasadas primeiro) e deixa o resto para depois. Sem horários. */
export default function TarefasHoje({ itens, hoje, concluidasHoje, minutosHoje, informado, minutosFeitos, adiantaveis, recursos }: { itens: T[]; hoje: string; concluidasHoje: number; minutosHoje: number; informado: boolean; minutosFeitos: number; adiantaveis: Adiantavel[]; recursos: boolean }) {
  const [feitas, setFeitas] = useState<ReadonlySet<string>>(new Set()), [minutos, setMinutos] = useState(minutosHoje), [inf, setInf] = useState(informado), [, start] = useTransition()
  const r = resumoHoje(itens, hoje, concluidasHoje, feitas)
  const d = dividirPorTempo([...r.atrasadas, ...r.deHoje], minutos)
  // sobra tempo hoje (já descontado o que foi feito): oferece trazer tarefas dos próximos dias, só quando você informou o tempo de hoje
  const [adiantados, setAdiantados] = useState<ReadonlySet<string>>(new Set()), [aviso, setAviso] = useState<string | null>(null)
  const livre = minutos - minutosFeitos - d.usado
  const adi = recursos && inf && minutos > 0 && !d.sobram.length ? escolherAdiantar(adiantaveis.filter(a => !adiantados.has(a.id)), livre) : []
  const adiantar = () => start(async () => {
    const x = await adiantarTarefas(adi.map(a => a.id))
    if (x.erro) setAviso(x.erro); else { setAviso(null); setAdiantados(s => new Set([...s, ...adi.map(a => a.id)])) }
  })
  const concluir = (id: string) => { setFeitas(s => new Set(s).add(id)); start(() => concluirItem(id)) }
  const escolher = (m: number) => { setMinutos(m); setInf(true); start(() => definirCapacidade(hoje, m)) }
  const linha = (t: T) => {
    const atraso = diffDays(t.data, hoje)
    const info = <span className="min-w-0 flex-1"><span className="block">{t.titulo}</span>
      <span className="block text-xs text-muted">{TIPO[t.tipo] ?? t.tipo} · {t.duracao_min ?? 30} min{atraso > 0 ? ` · ${atraso} ${atraso === 1 ? 'dia' : 'dias'} de atraso` : ''}</span></span>
    // revisão, questões e simulado não se "concluem" com um toque: levam ao registro, onde o resultado (e o XP) é contado
    const destino = t.tipo === 'revisao' ? '/revisoes' : t.tipo === 'simulado' ? '/simulados'
      : t.tipo === 'questoes' ? `/questoes?${[t.topic_id ? `alvo=t:${t.topic_id}` : '', t.qtd_questoes ? `total=${t.qtd_questoes}` : ''].filter(Boolean).join('&')}` : null
    return destino
      ? <li key={t.id}><Link href={destino} className="flex items-center gap-4 rounded-xl px-2 py-2.5 hover:bg-line/40">{info}<span className="rounded-full border border-info px-3 py-1 text-sm text-info">{t.tipo === 'revisao' ? 'Fazer' : 'Registrar'}</span></Link></li>
      : <li key={t.id} className="flex items-center gap-4 rounded-xl px-2 py-1.5 hover:bg-line/40">
          <button onClick={() => concluir(t.id)} role="checkbox" aria-checked={false} aria-label={`Concluir: ${t.titulo}`} className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-muted" />
          {info}<Link href={`/calendario?v=dia&d=${t.data}`} className="text-sm text-muted hover:text-brand">Abrir</Link></li>
  }
  return (
    <section className="space-y-4 rounded-2xl border border-line bg-surface p-5" aria-label="O que fazer hoje">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-lg font-semibold">Hoje</h2>
        {r.total > 0 && <span className="text-sm text-muted">{r.feitas} de {r.total} concluídas</span>}</div>
      {r.total > 0 && <Bar pct={r.pct} />}
      <div className="space-y-2">
        <p className="text-sm text-muted">Quanto tempo você tem hoje?</p>
        <div className="flex flex-wrap gap-2">{OPCOES_TEMPO.map(m => (
          <button key={m} type="button" onClick={() => escolher(m)} aria-pressed={inf && minutos === m}
            className={`rounded-xl border px-3.5 text-sm ${inf && minutos === m ? 'border-brand bg-brand/15 text-brand' : 'border-line'}`}>{formatarMinutos(m)}</button>))}</div>
        <p className="text-xs text-muted">{inf ? 'Mostro só o que cabe nesse tempo. O resto fica para depois, sem cobrança.' : `Usando o seu tempo padrão (${formatarMinutos(minutos)}). Toque acima para informar o de hoje.`}</p>
      </div>
      {recursos && r.atrasadas.length > 0 && <ReorganizarAtrasadas n={r.atrasadas.length} />}
      {minutos === 0 && <p className="text-sm">Sem tempo hoje? Tudo bem: nada é cobrado. As tarefas ficam para depois.</p>}
      {d.cabem.length > 0 && (
        <div className="space-y-1"><h3 className="text-sm font-medium text-info">Para fazer hoje ({formatarMinutos(d.usado)} de {formatarMinutos(minutos)})</h3><ul>{d.cabem.map(linha)}</ul>
          {d.maiorQueOTempo && <p className="px-2 text-xs text-warn">A primeira tarefa é maior que o tempo informado. Faça o que der.</p>}</div>)}
      {d.sobram.length > 0 && (
        <details className="text-sm"><summary className="cursor-pointer text-muted">Fica para depois ({d.sobram.length})</summary><ul className="mt-1">{d.sobram.map(linha)}</ul></details>)}
      {adi.length > 0 && (
        <div className="space-y-2 rounded-xl border border-line p-3 text-sm">
          <p>Sobra tempo hoje ({formatarMinutos(livre)}). Posso adiantar dos próximos dias:</p>
          <ul className="text-muted">{adi.map(a => <li key={a.id}>• {a.titulo} <span className="text-xs">({a.duracao_min ?? 30} min · {fmtData(a.data)})</span></li>)}</ul>
          <button onClick={adiantar} className="rounded-xl bg-brand px-4 py-2 font-medium text-black">Adiantar {adi.length} {adi.length === 1 ? 'tarefa' : 'tarefas'}</button>
        </div>)}
      {aviso && <p className="text-sm text-danger">{aviso}</p>}
      {!d.cabem.length && !d.sobram.length && <p className="text-sm text-muted">{r.total > 0 ? 'Tudo concluído por hoje.' : 'Nada pendente por enquanto.'} <Link href="/cronograma" className="text-brand underline">Ver o cronograma</Link></p>}
    </section>
  )
}
