'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { moverItem, adiarItem, concluirItem, excluirItem, editarItem } from '@/lib/calendar'
import { statusDe } from '@/lib/engine/calendar'
import { minParaHhmm, type Intervalo } from '@/lib/engine/compromissos'
import { fmtData, inputCls } from '@/components/ui'

export type Item = { id: string; tipo: string; titulo: string; data: string; hora_ini: string | null; hora_fim: string | null; duracao_min: number | null; qtd_questoes: number | null; status: string; origem: string; review_id?: string | null; topic_id?: string | null }
const COR: Record<string, string> = { concluido: 'border-brand bg-brand/10', agendado: 'border-info bg-info/10', proximo: 'border-warn bg-warn/10', atrasado: 'border-danger bg-danger/10' }
const ROTULO: Record<string, string> = { concluido: 'Concluído', agendado: 'Agendado', proximo: 'Próximo', atrasado: 'Atrasado' }
const TIPO: Record<string, string> = { estudo: 'Estudo', revisao: 'Revisão', questoes: 'Questões', flashcards: 'Flashcards', simulado: 'Simulado' }
const TIPO_COR: Record<string, string> = { questoes: 'text-violet', flashcards: 'text-pink', simulado: 'text-violet' }
const SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

export default function CalendarBoard({ items, dias, view, hoje, mes, ocupados }: { items: Item[]; dias: string[]; view: string; hoje: string; mes: string; ocupados: Record<string, Intervalo[]> }) {
  const [sel, setSel] = useState<Item | null>(null)
  const [novaData, setNovaData] = useState('')
  const [pending, start] = useTransition()
  const [editandoId, setEditandoId] = useState<string | null>(null), [ed, setEd] = useState({ titulo: '', hora: '', dur: '', qtd: '' }), [erro, setErro] = useState<string | null>(null)
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); setSel(null) })
  /** Move/adia; se cair sobre um compromisso, pergunta antes de forçar. Cancelar não muda nada. */
  const mover = (fn: (forcar: boolean) => Promise<{ conflito?: string }>) => start(async () => {
    const r = await fn(false)
    if (r.conflito) { if (!window.confirm(`⚠ Conflito de horário\n\n${r.conflito}\n\nMover mesmo assim?`)) return; await fn(true) }
    setSel(null)
  })
  const abrirEdicao = () => {
    if (!sel) return
    setEd({ titulo: sel.titulo, hora: sel.hora_ini?.slice(0, 5) ?? '', dur: sel.duracao_min ? String(sel.duracao_min) : '', qtd: sel.qtd_questoes ? String(sel.qtd_questoes) : '' })
    setErro(null); setEditandoId(sel.id)
  }
  const salvar = () => sel && start(async () => {
    let r = await editarItem(sel.id, ed, false)
    if (!r.erro && r.conflito) { if (!window.confirm(`⚠ Conflito de horário\n\n${r.conflito}\n\nSalvar mesmo assim?`)) return; r = await editarItem(sel.id, ed, true) }
    if (r.erro) { setErro(r.erro); return }
    setEditandoId(null); setSel(null)
  })
  const nomeDia = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'UTC' }).replace('-feira', '')
  const cols = view === 'dia' ? 'grid-cols-1' : view === 'semana' ? 'grid-cols-1 md:grid-cols-7' : 'grid-cols-7'
  const compacto = view === 'mes'

  return (
    <div className={pending ? 'opacity-60' : ''}>
      {compacto && <div className="mb-1 grid grid-cols-7 text-center text-xs text-muted">{SEMANA.map(s => <div key={s}>{s}</div>)}</div>}
      <div className={`grid gap-2 ${cols}`}>
        {dias.map(d => {
          const lista = items.filter(i => i.data === d)
          return (
            <section key={d} onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) mover(f => moverItem(id, d, f)) }}
              className={`min-h-24 space-y-1.5 rounded-xl border bg-surface p-2 ${d === hoje ? 'border-brand' : 'border-line'} ${compacto && d.slice(0, 7) !== mes ? 'opacity-40' : ''}`}>
              <h3 className="text-sm">{compacto ? +d.slice(8) : <><span className="capitalize">{nomeDia(d)}</span> <span className="text-muted">{d.slice(8)}/{d.slice(5, 7)}</span></>}</h3>
              {[...(ocupados[d] ?? [])].sort((a, b) => a.ini - b.ini).map((o, k) => (
                <div key={'o' + k} title={`${o.titulo}: ${minParaHhmm(o.ini)} às ${o.fim >= 1440 ? '24:00' : minParaHhmm(o.fim)}`}
                  className={`rounded-lg border-l-4 border-line bg-line/40 px-2 py-1 text-muted ${compacto ? 'truncate text-[11px]' : 'text-xs'}`}>
                  {compacto ? minParaHhmm(o.ini) : `${minParaHhmm(o.ini)}–${o.fim >= 1440 ? '24:00' : minParaHhmm(o.fim)}`} {o.titulo}</div>))}
              {lista.map(i => {
                const st = statusDe(i, hoje)
                return (
                  <div key={i.id} role="button" tabIndex={0} draggable={i.status !== 'concluido'}
                    onDragStart={e => e.dataTransfer.setData('text/plain', i.id)} onClick={() => { setSel(i); setNovaData(i.data) }}
                    onKeyDown={e => e.key === 'Enter' && (setSel(i), setNovaData(i.data))}
                    className={`cursor-pointer rounded-lg border-l-4 px-2 py-1.5 ${compacto ? 'truncate text-[11px]' : 'text-sm'} ${COR[st]}`}>
                    {!compacto && <span className={`block text-xs ${TIPO_COR[i.tipo] ?? 'text-muted'}`}>{TIPO[i.tipo]}{i.hora_ini ? ` · ${i.hora_ini.slice(0, 5)}` : ''}</span>}
                    <span className={st === 'concluido' ? 'line-through opacity-70' : ''}>{i.titulo}</span>
                  </div>)
              })}
            </section>)
        })}
      </div>

      {sel && (
        <div className="fixed inset-0 z-40 grid place-items-end bg-black/60 md:place-items-center" onClick={() => setSel(null)}>
          <div role="dialog" aria-modal="true" aria-label={sel.titulo} onClick={e => e.stopPropagation()} className="max-h-[90dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-2xl border border-line bg-surface p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:rounded-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><p className={`text-sm ${TIPO_COR[sel.tipo] ?? 'text-muted'}`}>{TIPO[sel.tipo]} · {ROTULO[statusDe(sel, hoje)]}</p><h2 className="text-lg font-semibold">{sel.titulo}</h2></div>
              <button onClick={() => setSel(null)} aria-label="Fechar" className="p-2 text-muted">✕</button>
            </div>
            <p className="text-sm text-muted">{fmtData(sel.data)}{sel.hora_ini ? ` · ${sel.hora_ini.slice(0, 5)}${sel.hora_fim ? `–${sel.hora_fim.slice(0, 5)}` : ''}` : ''}{sel.duracao_min ? ` · ${sel.duracao_min} min` : ''}{sel.qtd_questoes ? ` · ${sel.qtd_questoes} questões` : ''}{sel.origem === 'auto' ? ' · gerada pelo sistema' : ''}</p>
            {sel.status !== 'concluido' && <>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => run(() => concluirItem(sel.id))} className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-black">Concluir</button>
                <button onClick={() => mover(f => adiarItem(sel.id, f))} className="rounded-xl border border-line px-4 py-2 text-sm">Adiar 1 dia</button>
                <button onClick={abrirEdicao} className="rounded-xl border border-line px-4 py-2 text-sm">Editar</button>
                {sel.tipo === 'questoes' && <Link href={`/questoes?${[sel.topic_id ? `alvo=t:${sel.topic_id}` : '', sel.qtd_questoes ? `total=${sel.qtd_questoes}` : ''].filter(Boolean).join('&')}`}
                  className="rounded-xl border border-brand px-4 py-2 text-sm text-brand">Registrar questões</Link>}
                <button onClick={() => confirm('Excluir esta tarefa?') && run(() => excluirItem(sel.id))} className="rounded-xl px-4 py-2 text-sm text-danger hover:bg-danger/10">Excluir</button>
              </div>
              <div className="flex items-center gap-2"><input type="date" value={novaData} onChange={e => setNovaData(e.target.value)} className={inputCls} aria-label="Nova data" />
                <button onClick={() => mover(f => moverItem(sel.id, novaData, f))} className="rounded-xl border border-line px-4 py-2 text-sm">Mover para esta data</button></div>
              {editandoId === sel.id && (
                <div className="space-y-3 rounded-xl border border-line p-3">
                  <input value={ed.titulo} onChange={e => setEd({ ...ed, titulo: e.target.value })} disabled={!!sel.review_id} aria-label="Título" className={inputCls + ' w-full disabled:opacity-60'} />
                  {sel.review_id && <p className="text-xs text-muted">O título de uma revisão vem do assunto. Você pode ajustar horário e duração.</p>}
                  <div className="flex flex-wrap gap-2">
                    <input type="time" value={ed.hora} onChange={e => setEd({ ...ed, hora: e.target.value })} aria-label="Horário" className={inputCls} />
                    <input type="number" min={5} max={720} step={5} value={ed.dur} onChange={e => setEd({ ...ed, dur: e.target.value })} placeholder="Minutos" aria-label="Duração em minutos" className={inputCls + ' w-28'} />
                    {sel.tipo === 'questoes' && <input type="number" min={1} value={ed.qtd} onChange={e => setEd({ ...ed, qtd: e.target.value })} placeholder="Nº de questões" aria-label="Número de questões" className={inputCls + ' w-36'} />}
                  </div>
                  {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}
                  <div className="flex gap-2">
                    <button onClick={salvar} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-black">Salvar</button>
                    <button onClick={() => setEditandoId(null)} className="rounded-lg border border-line px-3 py-1.5 text-sm">Cancelar</button>
                  </div>
                </div>)}
            </>}
          </div>
        </div>)}
    </div>
  )
}
