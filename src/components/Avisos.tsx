'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { adicionarAviso, duracaoDoAviso, type TipoAviso } from '@/lib/engine/avisos'

export type NovoAviso = { tipo?: TipoAviso; conteudo: React.ReactNode; acao?: { rotulo: string; fazer: () => void | Promise<void> }; duracao?: number | null }
type Aviso = NovoAviso & { id: number; tipo: TipoAviso }
type Valor = { mostrar: (a: NovoAviso) => number; fechar: (id: number) => void }

const Ctx = createContext<Valor>({ mostrar: () => 0, fechar: () => {} })
/** Para mostrar um aviso temporário de qualquer lugar do app. Fora do app (sem o provedor), não faz nada. */
export const useAvisos = () => useContext(Ctx)

const BORDA: Record<TipoAviso, string> = { ok: 'border-l-brand', info: 'border-l-info', erro: 'border-l-danger' }

function Item({ a, fechar }: { a: Aviso; fechar: (id: number) => void }) {
  const total = duracaoDoAviso(a.tipo, !!a.acao, a.duracao)
  const [pausado, setPausado] = useState(false), [pend, setPend] = useState(false)
  const restante = useRef(total ?? 0)
  // o relógio do aviso para enquanto a pessoa está com o dedo/mouse/foco nele (dá tempo de ler e de tocar em "Desfazer")
  useEffect(() => {
    if (total === null || pausado) return
    const inicio = Date.now(), t = setTimeout(() => fechar(a.id), restante.current)
    return () => { clearTimeout(t); restante.current = Math.max(0, restante.current - (Date.now() - inicio)) }
  }, [pausado, total, a.id, fechar])
  return (
    <div role={a.tipo === 'erro' ? 'alert' : 'status'}
      onMouseEnter={() => setPausado(true)} onMouseLeave={() => setPausado(false)} onFocus={() => setPausado(true)}
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPausado(false) }}
      className={`pointer-events-auto flex items-start gap-2 rounded-xl border border-l-4 border-line ${BORDA[a.tipo]} bg-surface p-2 pl-4 text-sm shadow-lg motion-safe:animate-[aviso-entra_180ms_ease-out]`}>
      <div className="min-w-0 flex-1 break-words py-2">{a.conteudo}</div>
      {a.acao && (
        <button type="button" disabled={pend} onClick={async () => { setPend(true); try { await a.acao!.fazer() } finally { fechar(a.id) } }}
          className="shrink-0 rounded-lg px-3 py-2 font-medium text-brand hover:bg-brand/10 disabled:opacity-50">{a.acao.rotulo}</button>)}
      <button type="button" onClick={() => fechar(a.id)} aria-label="Fechar aviso" className="shrink-0 rounded-lg px-2.5 py-2 text-muted hover:text-brand">✕</button>
    </div>)
}

/**
 * Avisos temporários do app: aparecem no topo (longe do menu inferior e do cronômetro), somem sozinhos e pausam enquanto você os segura.
 * Sucesso e informação ficam 6 s; erro, 15 s; com botão de ação (ex.: Desfazer), pelo menos 8 s. No máximo 3 de uma vez.
 */
export function AvisosProvider({ children }: { children: React.ReactNode }) {
  const [lista, setLista] = useState<Aviso[]>([]), seq = useRef(0)
  const fechar = useCallback((id: number) => setLista(l => l.filter(a => a.id !== id)), [])
  const mostrar = useCallback((n: NovoAviso) => { const id = ++seq.current; setLista(l => adicionarAviso(l, { ...n, tipo: n.tipo ?? 'ok', id })); return id }, [])
  const valor = useMemo(() => ({ mostrar, fechar }), [mostrar, fechar])
  return (
    <Ctx.Provider value={valor}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-3 top-[calc(0.75rem+env(safe-area-inset-top))] z-[60] mx-auto flex max-w-md flex-col gap-2">
        {lista.map(a => <Item key={a.id} a={a} fechar={fechar} />)}
      </div>
    </Ctx.Provider>)
}
