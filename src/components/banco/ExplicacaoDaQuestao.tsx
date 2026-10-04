'use client'
import { useState, useTransition } from 'react'
import { reportarExplicacao, salvarExplicacao } from '@/lib/banco'
import { inputCls } from '@/components/ui'

/**
 * A explicação de uma questão (texto original, escrito por IA ou revisado pela administradora; não é o comentário de cursinho).
 * Quem estuda pode reportar erro; a administradora (podeEditar) escreve, corrige ou apaga.
 */
export default function ExplicacaoDaQuestao({ id, texto, origem, podeEditar = false }: { id: string; texto: string | null; origem: string | null; podeEditar?: boolean }) {
  const [atual, setAtual] = useState({ texto, origem }), [editando, setEditando] = useState(false), [rascunho, setRascunho] = useState(texto ?? '')
  const [reportando, setReportando] = useState(false), [motivo, setMotivo] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null), [pend, start] = useTransition()

  const salvar = () => start(async () => {
    const r = await salvarExplicacao(id, rascunho).catch(() => ({ ok: false, erro: 'Sem conexão.' }))
    if (!r.ok) { setMsg({ ok: false, t: r.erro ?? 'Não foi possível salvar.' }); return }
    setAtual({ texto: rascunho.trim() || null, origem: rascunho.trim() ? 'revisada' : null }); setEditando(false)
    setMsg({ ok: true, t: 'Salvo. Publique a questão de novo para chegar às outras contas.' })
  })
  const reportar = () => start(async () => {
    const r = await reportarExplicacao(id, motivo).catch(() => ({ ok: false, erro: 'Sem conexão.' }))
    if (!r.ok) { setMsg({ ok: false, t: r.erro ?? 'Não foi possível enviar.' }); return }
    setReportando(false); setMotivo(''); setMsg({ ok: true, t: 'Obrigado! O erro foi enviado para revisão.' })
  })

  if (!atual.texto && !podeEditar) return null
  return (
    <div className="space-y-2 rounded-lg border border-line bg-line/20 p-3 text-sm">
      <p className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className={atual.origem === 'revisada' ? 'text-brand' : 'text-warn'}>{!atual.texto ? 'Sem explicação' : atual.origem === 'revisada' ? 'Explicação (revisada)' : 'Explicação gerada por IA: confira'}</span>
        <span className="flex gap-3">
          {podeEditar && !editando && <button type="button" onClick={() => { setRascunho(atual.texto ?? ''); setEditando(true); setMsg(null) }} className="text-brand hover:underline">{atual.texto ? 'Editar' : 'Escrever'}</button>}
          {!podeEditar && atual.texto && !reportando && <button type="button" onClick={() => { setReportando(true); setMsg(null) }} className="text-muted hover:text-danger hover:underline">Reportar erro</button>}
        </span>
      </p>
      {editando
        ? <div className="space-y-2">
          <textarea value={rascunho} onChange={e => setRascunho(e.target.value)} rows={6} maxLength={8000} aria-label="Explicação" className={inputCls + ' w-full'} />
          <div className="flex gap-2"><button type="button" onClick={salvar} disabled={pend} className="rounded-lg bg-brand px-3 py-1.5 font-medium text-black disabled:opacity-40">{pend ? 'Salvando…' : 'Salvar'}</button>
            <button type="button" onClick={() => setEditando(false)} className="px-2 text-muted hover:underline">Cancelar</button>
            {atual.texto && <button type="button" onClick={() => { setRascunho(''); }} className="ml-auto px-2 text-danger hover:underline">Apagar o texto</button>}</div>
        </div>
        : atual.texto && <p className="whitespace-pre-line">{atual.texto}</p>}
      {reportando && <div className="space-y-2">
        <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={2} maxLength={1000} placeholder="O que está errado? (ex.: a alternativa C também está correta pela diretriz de 2025)" aria-label="O que está errado" className={inputCls + ' w-full'} />
        <div className="flex gap-2"><button type="button" onClick={reportar} disabled={pend || motivo.trim().length < 3} className="rounded-lg border border-danger px-3 py-1.5 text-danger disabled:opacity-40">{pend ? 'Enviando…' : 'Enviar'}</button>
          <button type="button" onClick={() => setReportando(false)} className="px-2 text-muted hover:underline">Cancelar</button></div>
      </div>}
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`text-xs ${msg.ok ? 'text-brand' : 'text-danger'}`}>{msg.t}</p>}
    </div>)
}
