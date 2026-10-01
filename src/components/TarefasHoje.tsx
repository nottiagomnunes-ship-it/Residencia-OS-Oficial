'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { concluirItem } from '@/lib/calendar'
import { resumoHoje } from '@/lib/engine/hoje'
import { diffDays } from '@/lib/engine/review'
import { Bar } from '@/components/ui'

type T = { id: string; tipo: string; titulo: string; data: string; hora_ini: string | null; hora_fim: string | null }
const TIPO: Record<string, string> = { estudo: 'Estudo', revisao: 'Revisão', questoes: 'Questões', flashcards: 'Flashcards', simulado: 'Simulado' }
const MAX = 8

/** O que fazer agora: atrasadas primeiro, depois as de hoje. Toque na bolinha para concluir; revisões abrem a central (para registrar o desempenho). */
export default function TarefasHoje({ itens, hoje, concluidasHoje }: { itens: T[]; hoje: string; concluidasHoje: number }) {
  const [feitas, setFeitas] = useState<ReadonlySet<string>>(new Set()), [, start] = useTransition()
  const r = resumoHoje(itens, hoje, concluidasHoje, feitas)
  const concluir = (id: string) => { setFeitas(s => new Set(s).add(id)); start(() => concluirItem(id)) }
  const linha = (t: T) => {
    const atraso = diffDays(t.data, hoje), hora = t.hora_ini ? t.hora_ini.slice(0, 5) + (t.hora_fim ? `–${t.hora_fim.slice(0, 5)}` : '') : null
    const info = <span className="min-w-0 flex-1"><span className="block">{t.titulo}</span>
      <span className="block text-xs text-muted">{TIPO[t.tipo] ?? t.tipo}{hora ? ` · ${hora}` : ''}{atraso > 0 ? ` · ${atraso} ${atraso === 1 ? 'dia' : 'dias'} de atraso` : ''}</span></span>
    return t.tipo === 'revisao'
      ? <li key={t.id}><Link href="/revisoes" className="flex items-center gap-4 rounded-xl px-2 py-2.5 hover:bg-line/40">{info}<span className="rounded-full border border-info px-3 py-1 text-sm text-info">Fazer</span></Link></li>
      : <li key={t.id} className="flex items-center gap-4 rounded-xl px-2 py-1.5 hover:bg-line/40">
          <button onClick={() => concluir(t.id)} role="checkbox" aria-checked={false} aria-label={`Concluir: ${t.titulo}`} className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-muted" />
          {info}<Link href={`/calendario?v=dia&d=${t.data}`} className="text-sm text-muted hover:text-brand">Abrir</Link></li>
  }
  const bloco = (titulo: string, cor: string, l: T[]) => l.length > 0 && (
    <div className="space-y-1"><h3 className={`text-sm font-medium ${cor}`}>{titulo} ({l.length})</h3><ul>{l.slice(0, MAX).map(linha)}</ul>
      {l.length > MAX && <Link href="/calendario" className="block px-2 text-sm text-brand">Ver as outras {l.length - MAX} no calendário</Link>}</div>)
  return (
    <section className="space-y-4 rounded-2xl border border-line bg-surface p-5" aria-label="O que fazer hoje">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-lg font-semibold">Hoje</h2>
        {r.total > 0 && <span className="text-sm text-muted">{r.feitas} de {r.total} concluídas</span>}</div>
      {r.total > 0 && <Bar pct={r.pct} />}
      {bloco('Atrasadas', 'text-danger', r.atrasadas)}{bloco('Para hoje', 'text-info', r.deHoje)}
      {!r.atrasadas.length && !r.deHoje.length && <p className="text-sm text-muted">{r.total > 0 ? 'Tudo concluído por hoje.' : 'Nada pendente por enquanto.'} <Link href="/cronograma" className="text-brand underline">Ver o cronograma</Link></p>}
    </section>
  )
}
