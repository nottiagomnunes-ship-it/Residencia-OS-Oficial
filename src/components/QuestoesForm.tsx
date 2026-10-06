'use client'
import { useState } from 'react'
import { registrarQuestoes } from '@/lib/questoes'
import { AlvoSelect } from '@/components/AlvoSelect'
import { inputCls } from '@/components/ui'
import { resumoQuestoes } from '@/lib/engine/questoes'

const ATALHOS = [10, 20, 30, 40, 50]
const COR = { neutro: '', bom: 'text-brand', medio: 'text-warn', baixo: 'text-danger', erro: 'text-danger' } as const

export default function QuestoesForm({ ds, ts, alvo, totalInicial, tempoInicial, hoje, className = '' }: {
  ds: { id: string; nome: string }[]; ts: { id: string; nome: string; discipline_id: string }[]; alvo?: string; totalInicial?: string; tempoInicial?: string; hoje: string; className?: string
}) {
  const [total, setTotal] = useState(totalInicial ?? ''), [acertos, setAcertos] = useState('')
  const r = resumoQuestoes(total, acertos)
  return (
    <form action={registrarQuestoes} className={`space-y-4 rounded-2xl border border-line bg-surface p-5 ${className}`}>
      <h2 className="font-medium">Registrar questões</h2>
      <AlvoSelect ds={ds} ts={ts} defaultValue={alvo} />
      <div className="space-y-2">
        <label htmlFor="q-total" className="block text-sm text-muted">Quantas questões você fez?</label>
        <div className="flex flex-wrap gap-2">{ATALHOS.map(n => (
          <button key={n} type="button" onClick={() => setTotal(String(n))} aria-pressed={total === String(n)}
            className={`rounded-xl border px-4 text-sm ${total === String(n) ? 'border-brand bg-brand/15 text-brand' : 'border-line'}`}>{n}</button>))}</div>
        <input id="q-total" name="total" type="number" inputMode="numeric" min={1} required value={total} onChange={e => setTotal(e.target.value)} placeholder="Ou digite outro número" className={inputCls + ' w-full'} />
      </div>
      <div className="space-y-2">
        <label htmlFor="q-acertos" className="block text-sm text-muted">Quantas você acertou?</label>
        <input id="q-acertos" name="acertos" type="number" inputMode="numeric" min={0} required value={acertos} onChange={e => setAcertos(e.target.value)} placeholder="Acertos" className={inputCls + ' w-full'} />
        <p aria-live="polite" className={`min-h-5 text-sm font-medium ${COR[r.tipo]}`}>{r.mensagem}</p>
      </div>
      <label className="block space-y-1 text-sm text-muted"><span>Data</span><input name="data" type="date" defaultValue={hoje} className={inputCls + ' w-full'} /></label>
      <details className="rounded-xl border border-line p-3 text-sm">
        <summary className="cursor-pointer text-muted">Mais detalhes (banca, prova, tempo…)</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <input name="banca" placeholder="Banca" className={inputCls} /><input name="prova" placeholder="Prova" className={inputCls} />
          <input name="ano" type="number" inputMode="numeric" min={1990} max={2100} placeholder="Ano" className={inputCls} />
          <input name="tempo_min" type="number" inputMode="numeric" min={0} defaultValue={tempoInicial} placeholder="Tempo (min)" className={inputCls} />
          <select name="dificuldade" defaultValue="" aria-label="Dificuldade" className={inputCls}><option value="">Dificuldade</option><option value={1}>Fácil</option><option value={2}>Médio</option><option value={3}>Difícil</option></select>
        </div>
      </details>
      <button disabled={!r.valido} className="w-full rounded-xl bg-brand px-4 py-3 font-medium text-on-cor disabled:opacity-50">Registrar</button>
    </form>
  )
}
