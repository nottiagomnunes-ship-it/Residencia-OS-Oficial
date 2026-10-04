'use client'
import { useMemo, useState, useTransition } from 'react'
import { aplicarEmLote, desfazerUltimoLote } from '@/lib/etapas'
import { selecionarAssuntos, type Modelo, type TopicoLote } from '@/lib/engine/etapas'
import { inputCls } from '@/components/ui'

export default function EtapasEmLote({ topicos, etapasPorTopico, disciplinas, modelos, ultimo }: {
  topicos: TopicoLote[]; etapasPorTopico: Record<string, number>; disciplinas: { id: string; nome: string }[]; modelos: Modelo[]
  ultimo: { id: string; em: string; etapas: number; assuntos: number; concluidas: number; desfazivel: boolean; minutosRestantes: number } | null
}) {
  const [escopo, setEscopo] = useState('sem_etapas'), [modelo, setModelo] = useState('conjunto'), [pular, setPular] = useState(true)
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null), [pend, start] = useTransition()
  const grupos = useMemo(() => [...new Set(topicos.map(t => t.grupo).filter(Boolean))] as string[], [topicos])
  const ids = useMemo(() => selecionarAssuntos(topicos, etapasPorTopico, escopo, pular), [topicos, etapasPorTopico, escopo, pular])
  const nConjunto = modelos.filter(m => m.conjunto).length
  const nomeModelo = modelo === 'conjunto' ? 'o conjunto padrão' : `“${modelos.find(m => m.id === modelo)?.titulo ?? ''}”`

  function aplicar() {
    if (!ids.length || !window.confirm(`Adicionar ${nomeModelo} a ${ids.length} ${ids.length === 1 ? 'assunto' : 'assuntos'}?`)) return
    start(async () => {
      const r = await aplicarEmLote(escopo, modelo, pular)
      setMsg(r.erro ? { ok: false, t: r.erro } : { ok: true, t: r.etapas ? `${r.etapas} etapas adicionadas em ${r.assuntos} assuntos.` : 'Nada a adicionar: os assuntos já tinham essas etapas.' })
    })
  }
  function desfazer() {
    if (!ultimo) return
    const n = ultimo.etapas - ultimo.concluidas
    if (!window.confirm(`Remover as ${n} etapas ainda não concluídas do último lote${ultimo.concluidas ? ` (as ${ultimo.concluidas} já concluídas ficam)` : ''}?`)) return
    start(async () => {
      const r = await desfazerUltimoLote()
      setMsg(r.erro ? { ok: false, t: r.erro } : { ok: true, t: `${r.removidas} etapas removidas${r.mantidas ? `; ${r.mantidas} concluídas foram mantidas` : ''}.` })
    })
  }
  const quando = ultimo ? new Date(ultimo.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : ''
  const mr = ultimo?.minutosRestantes ?? 0, restante = mr >= 60 ? `${Math.floor(mr / 60)} h${mr % 60 ? ` ${mr % 60} min` : ''}` : `${mr} min`
  return (
    <details className="rounded-2xl border border-line bg-surface p-4">
      <summary className="cursor-pointer text-sm font-medium text-brand">Aplicar etapas a vários assuntos de uma vez</summary>
      <div className="mt-4 space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted">Aplicar</span>
          <select value={modelo} onChange={e => setModelo(e.target.value)} aria-label="Padrão a aplicar" className={inputCls}>
            <option value="conjunto">Conjunto padrão ({nConjunto || 3} itens)</option>
            {modelos.map(m => <option key={m.id} value={m.id}>{m.titulo}</option>)}
          </select>
          <span className="text-muted">em</span>
          <select value={escopo} onChange={e => setEscopo(e.target.value)} aria-label="Quais assuntos" className={inputCls}>
            <option value="sem_etapas">todos os assuntos sem etapas</option>
            <option value="todos">todos os assuntos não concluídos</option>
            {grupos.map(g => <option key={g} value={`g:${g}`}>{g}</option>)}
            {disciplinas.map(d => <option key={d.id} value={`d:${d.id}`}>disciplina: {d.nome}</option>)}
          </select>
        </div>
        {escopo !== 'sem_etapas' && <label className="flex items-center gap-2 text-muted"><input type="checkbox" checked={pular} onChange={e => setPular(e.target.checked)} className="accent-brand" />Pular assuntos que já têm etapas</label>}
        <p aria-live="polite">{ids.length ? `Atinge ${ids.length} ${ids.length === 1 ? 'assunto' : 'assuntos'} (concluídos ficam de fora).` : 'Nenhum assunto se encaixa neste escopo.'}</p>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={aplicar} disabled={pend || !ids.length} className="rounded-xl bg-brand px-4 py-2 font-medium text-black disabled:opacity-50">{pend ? 'Aplicando…' : 'Aplicar'}</button>
          <span className="text-xs text-muted">Nunca repete uma etapa que o assunto já tem. Para editar os padrões, abra um assunto e use “Gerenciar padrões”.</span>
        </div>
        {ultimo && (
          <div className="space-y-2 border-t border-line pt-3">
            <p className="text-muted">Último lote: {ultimo.etapas} etapas em {ultimo.assuntos} {ultimo.assuntos === 1 ? 'assunto' : 'assuntos'}, aplicado em {quando}{ultimo.concluidas ? ` (${ultimo.concluidas} já concluídas)` : ''}.</p>
            {ultimo.desfazivel ? (<>
              <button onClick={desfazer} disabled={pend} className="rounded-xl border border-line px-4 py-2 hover:border-danger hover:text-danger disabled:opacity-50">Desfazer último lote</button>
              <p className="text-xs text-muted">Pode ser desfeito por mais {restante}.</p></>
            ) : <p className="text-xs text-muted">Passaram-se mais de 24 h: este lote não pode mais ser desfeito. Para remover etapas, exclua-as em cada assunto.</p>}
          </div>)}
        {msg && <p role={msg.ok ? 'status' : 'alert'} className={msg.ok ? 'text-brand' : 'text-danger'}>{msg.t}</p>}
      </div>
    </details>
  )
}
