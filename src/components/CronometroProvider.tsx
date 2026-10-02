'use client'
import { createContext, useContext, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { iniciarCronometro, pausarCronometro, retomarCronometro, finalizarCronometro, descartarCronometro } from '@/lib/cronometro'
import {
  segundosDecorridos, formatarRelogio, minutosParaRegistrar, pareceEsquecido, progressoPlanejado, opcoesDeFinalizar, destinoDoRegistro, LIMITE_MAX_MIN, LIMITE_SESSAO_MIN,
  type Cron, type OpcaoId,
} from '@/lib/engine/cronometro'
import { Bar, inputCls } from '@/components/ui'

type Valor = { disponivel: boolean; ativo: Cron | null; iniciar: (itemId: string | null, titulo?: string) => void; ocupado: boolean }
const Ctx = createContext<Valor>({ disponivel: false, ativo: null, iniciar: () => {}, ocupado: false })
export const useCronometro = () => useContext(Ctx)

/**
 * O cronômetro de estudo: um por pessoa, guardado no servidor. Este componente mantém o relógio na tela, a barra fixa (visível em qualquer página)
 * e o diálogo de finalizar. O tempo vem sempre do servidor (início e pausas), então continua certo ao navegar, recarregar ou trocar de aparelho.
 */
export default function CronometroProvider({ disponivel, ativo: ativoServidor, agora, children }: { disponivel: boolean; ativo: Cron | null; agora: number; children: React.ReactNode }) {
  const router = useRouter()
  const [ativo, setAtivo] = useState<Cron | null>(ativoServidor)
  const [agoraMs, setAgoraMs] = useState(agora)
  const dif = useRef(0)   // diferença entre o relógio do servidor e o deste aparelho
  const [aviso, setAviso] = useState<string | null>(null)
  const [dialogo, setDialogo] = useState<{ minutos: string; passou: boolean } | null>(null)
  const [pend, start] = useTransition()
  const tituloAntes = useRef<string | null>(null)
  const chave = ativoServidor ? `${ativoServidor.id}|${ativoServidor.pausado}|${ativoServidor.acumulado_seg}|${ativoServidor.iniciado_em}` : 'nenhum'

  // acompanha o servidor (recarregar a página, outro aparelho) e acerta o relógio
  useEffect(() => { setAtivo(ativoServidor); dif.current = agora - Date.now(); setAgoraMs(Date.now() + dif.current) }, [chave]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ativo || ativo.pausado) return
    setAgoraMs(Date.now() + dif.current)
    const t = setInterval(() => setAgoraMs(Date.now() + dif.current), 1000)
    return () => clearInterval(t)
  }, [ativo])
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(null), 9000); return () => clearTimeout(t) }, [aviso])

  const seg = ativo ? segundosDecorridos(ativo, agoraMs) : 0
  // o relógio também aparece na aba do navegador, para acompanhar sem ficar nesta tela
  useEffect(() => {
    if (!ativo) { if (tituloAntes.current !== null) { document.title = tituloAntes.current; tituloAntes.current = null } return }
    if (tituloAntes.current === null) tituloAntes.current = document.title
    document.title = `${ativo.pausado ? '⏸' : '⏱'} ${formatarRelogio(seg)} · ${ativo.titulo}`
  }, [ativo, seg])

  const iniciar = (itemId: string | null, titulo?: string) => start(async () => {
    setAviso(null)
    const r = await iniciarCronometro(itemId, titulo)
    if (r.cron) { setAtivo(r.cron); return }
    setAviso(r.erro === 'ativo' ? `Já há um cronômetro em andamento${r.ativo ? ` (${r.ativo})` : ''}. Finalize ou descarte antes de iniciar outro.` : 'Não foi possível iniciar o cronômetro. Tente de novo.')
  })
  const alternar = () => ativo && start(async () => {
    const r = await (ativo.pausado ? retomarCronometro() : pausarCronometro())
    if (r.cron) setAtivo(r.cron); else setAviso('Não foi possível atualizar o cronômetro. Tente de novo.')
  })
  // finalizar pausa na hora (o tempo para de contar enquanto você decide) e abre o diálogo com os minutos sugeridos
  const finalizar = () => ativo && start(async () => {
    let c = ativo
    if (!c.pausado) { const r = await pausarCronometro(); if (r.cron) { c = r.cron; setAtivo(c) } }
    const m = minutosParaRegistrar(segundosDecorridos(c, Date.now() + dif.current))
    setDialogo({ minutos: String(m.minutos), passou: m.passouDoLimite })
  })
  const minutosNum = dialogo ? Number(dialogo.minutos) : 0
  const valido = Number.isInteger(minutosNum) && minutosNum >= 1 && minutosNum <= LIMITE_MAX_MIN
  const escolher = (id: OpcaoId) => ativo && start(async () => {
    if (id === 'registrar') { // o registro (questões, simulado, resultado da revisão) recebe o tempo pelo formulário
      const destino = destinoDoRegistro(ativo, minutosNum)
      await descartarCronometro(); setAtivo(null); setDialogo(null)
      if (destino) router.push(destino)
      return
    }
    const r = await finalizarCronometro(id, minutosNum)
    if (r.ok) { setAtivo(null); setDialogo(null); setAviso(r.aviso ?? `Registrei ${minutosNum} min de estudo.`); router.refresh() }
    else setAviso(r.erro ?? 'Não foi possível finalizar. Tente de novo.')
  })
  const descartar = () => { if (window.confirm('Descartar este cronômetro sem registrar o tempo?')) start(async () => { await descartarCronometro(); setAtivo(null); setDialogo(null) }) }

  const prog = ativo ? progressoPlanejado(seg, ativo.planejado_min) : null
  return (
    <Ctx.Provider value={{ disponivel, ativo, iniciar, ocupado: pend }}>
      {children}
      {ativo && <div aria-hidden className="h-24 lg:h-0" />}
      {(ativo || aviso) && (
        <div className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 space-y-2 lg:inset-x-auto lg:bottom-4 lg:right-4 lg:w-[26rem]">
          {aviso && (
            <div role="status" className="flex items-start justify-between gap-3 rounded-xl border border-line bg-surface p-3 text-sm shadow-lg">
              <span>{aviso}</span><button onClick={() => setAviso(null)} aria-label="Fechar aviso" className="text-muted">✕</button>
            </div>)}
          {ativo && (
            <section aria-label="Cronômetro de estudo" className="rounded-2xl border border-line bg-surface p-3 shadow-lg">
              <div className="flex items-center gap-3">
                <span className={`font-mono text-2xl tabular-nums ${ativo.pausado ? 'text-muted' : 'text-brand'}`}>{formatarRelogio(seg)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{ativo.titulo}</p>
                  <p className="text-xs text-muted">{ativo.pausado ? 'Pausado' : 'Estudando'}{ativo.planejado_min ? ` · planejado ${ativo.planejado_min} min` : ''}</p>
                </div>
                <button onClick={alternar} disabled={pend} className="rounded-xl border border-line px-3 py-2 text-sm hover:border-brand disabled:opacity-60">{ativo.pausado ? 'Retomar' : 'Pausar'}</button>
                <button onClick={finalizar} disabled={pend} className="rounded-xl bg-brand px-3 py-2 text-sm font-medium text-black disabled:opacity-60">Finalizar</button>
              </div>
              {prog != null && <div className="mt-2"><Bar pct={prog} /></div>}
              {pareceEsquecido(seg) && <p className="mt-2 text-xs text-muted">Está contando há mais de 3 h. Esqueceu de pausar? Você ajusta os minutos ao finalizar.</p>}
            </section>)}
        </div>)}

      {dialogo && ativo && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 md:place-items-center" onClick={() => setDialogo(null)}>
          <div role="dialog" aria-modal="true" aria-label="Finalizar cronômetro" onClick={e => e.stopPropagation()}
            className="max-h-[90dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-2xl border border-line bg-surface p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:rounded-2xl">
            <div><h2 className="text-lg font-semibold">Finalizar</h2><p className="text-sm text-muted">{ativo.titulo}</p></div>
            <label className="block space-y-1 text-sm">Minutos estudados
              <input type="number" inputMode="numeric" min={1} max={LIMITE_MAX_MIN} value={dialogo.minutos} onChange={e => setDialogo({ ...dialogo, minutos: e.target.value })} className={inputCls + ' w-full'} aria-label="Minutos estudados" />
            </label>
            {dialogo.passou && <p className="text-xs text-muted">O cronômetro passou de {LIMITE_SESSAO_MIN / 60} h, então sugeri {LIMITE_SESSAO_MIN / 60} h. Corrija se precisar.</p>}
            {!valido && <p role="alert" className="text-sm text-danger">Informe de 1 a {LIMITE_MAX_MIN} minutos.</p>}
            <div className="space-y-2">
              {opcoesDeFinalizar(ativo, valido ? minutosNum : 0).map(o => (
                <button key={o.id} onClick={() => escolher(o.id)} disabled={!valido || pend}
                  className={`block w-full rounded-xl border px-4 py-3 text-left disabled:opacity-50 ${o.id === 'tempo' ? 'border-line' : 'border-brand bg-brand/10'}`}>
                  <span className="block font-medium">{o.rotulo}</span><span className="block text-xs text-muted">{o.detalhe}</span>
                </button>))}
            </div>
            <div className="flex justify-between text-sm">
              <button onClick={() => setDialogo(null)} className="text-muted hover:text-brand">Voltar (continua pausado)</button>
              <button onClick={descartar} className="text-danger hover:underline">Descartar</button>
            </div>
          </div>
        </div>)}
    </Ctx.Provider>
  )
}
