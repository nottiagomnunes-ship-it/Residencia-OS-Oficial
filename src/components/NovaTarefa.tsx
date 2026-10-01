'use client'
import { useRef, useState, useTransition } from 'react'
import { criarItem } from '@/lib/calendar'
import { inputCls } from '@/components/ui'

export default function NovaTarefa({ ancora }: { ancora: string }) {
  const [aviso, setAviso] = useState<string | null>(null), [pend, start] = useTransition()
  const form = useRef<HTMLFormElement>(null), dados = useRef<FormData | null>(null)

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget); dados.current = fd
    start(async () => { const r = await criarItem(fd); if (r.conflito) setAviso(r.conflito); else { setAviso(null); if (r.ok) form.current?.reset() } })
  }
  function criarMesmoAssim() {
    const fd = dados.current; if (!fd) return
    fd.set('forcar', '1')
    start(async () => { await criarItem(fd); setAviso(null); form.current?.reset() })
  }
  return (
    <details className="rounded-2xl border border-line bg-surface p-4">
      <summary className="cursor-pointer text-sm font-medium text-brand">Nova tarefa</summary>
      <form ref={form} onSubmit={enviar} className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <input name="titulo" required placeholder="Título" className={inputCls + ' sm:col-span-3 xl:col-span-2'} />
        <select name="tipo" defaultValue="estudo" aria-label="Tipo" className={inputCls}><option value="estudo">Estudo</option><option value="questoes">Questões</option><option value="flashcards">Flashcards</option><option value="simulado">Simulado</option></select>
        <input name="data" type="date" required defaultValue={ancora} aria-label="Data" className={inputCls} />
        <input name="hora_ini" type="time" aria-label="Horário" className={inputCls} />
        <input name="duracao_min" type="number" min={5} step={5} placeholder="Minutos" className={inputCls} />
        <input name="qtd_questoes" type="number" min={1} placeholder="Nº de questões" className={inputCls} />
        <button disabled={pend} className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-black disabled:opacity-60 sm:col-span-3 xl:col-span-6">{pend ? 'Salvando…' : 'Adicionar ao calendário'}</button>
      </form>
      {aviso && (
        <div role="alert" className="mt-4 space-y-3 rounded-xl border border-warn/40 bg-warn/10 p-4 text-sm">
          <p>⚠ {aviso}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={criarMesmoAssim} disabled={pend} className="rounded-lg bg-warn px-3 py-1.5 font-medium text-black disabled:opacity-60">Criar mesmo assim</button>
            <button type="button" onClick={() => setAviso(null)} className="rounded-lg border border-line px-3 py-1.5">Ajustar horário</button>
          </div>
        </div>)}
    </details>
  )
}
