'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { liberarHorario, excluirHorarioDaAgenda, desfazerNaAgenda, type DesfazerAgenda } from '@/lib/agenda'
import { useAvisos } from '@/components/Avisos'
import { minParaHhmm, type Intervalo } from '@/lib/engine/compromissos'
import { corDaCategoria, CATEGORIAS, ehCategoria } from '@/lib/engine/agenda'
import { fmtData } from '@/components/ui'

const hora = (m: number) => (m >= 1440 ? '24:00' : minParaHhmm(m))

/**
 * Um bloco da agenda pessoal no Calendário (ou na Agenda). Tocar abre as opções: liberar o horário só naquele dia ou, se ele se repete,
 * excluir de todas as semanas. Depois de liberar, o tempo livre do dia é recalculado; "Desfazer" fica no aviso por alguns segundos.
 */
export default function BlocoAgenda({ o, className, children }: { o: Intervalo; className: string; children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false), [pend, start] = useTransition()
  const router = useRouter(), { mostrar } = useAvisos()
  const cor = o.cor ?? corDaCategoria(o.categoria)
  if (!o.id || !o.inicio) return <div title={o.titulo} style={{ borderLeftColor: cor }} className={className}>{children}</div>
  const nome = (o.titulo ?? '').replace(/ \(continuação\)$/, '')
  const agir = (fn: () => Promise<{ ok: boolean; erro?: string; desfazer?: DesfazerAgenda }>, feito: string) => start(async () => {
    const r = await fn().catch(() => ({ ok: false, erro: undefined, desfazer: undefined }))
    if (!r.ok) { mostrar({ tipo: 'erro', conteudo: r.erro ?? 'Não foi possível. Tente de novo.' }); return }
    setAberto(false); router.refresh()
    const d = r.desfazer
    mostrar({ conteudo: feito, acao: d ? { rotulo: 'Desfazer', fazer: async () => { await desfazerNaAgenda(d); router.refresh() } } : undefined })
  })
  return (
    <>
      <button type="button" onClick={() => setAberto(true)} title={`${nome}: ${hora(o.ini)} às ${hora(o.fim)}`} aria-haspopup="dialog"
        aria-label={`${nome}, ${hora(o.ini)} às ${hora(o.fim)}. Abrir opções`} style={{ borderLeftColor: cor }} className={`${className} w-full text-left hover:bg-line/70`}>{children}</button>
      {aberto && (
        <div className="fixed inset-0 z-40 grid place-items-end bg-black/60 md:place-items-center" onClick={() => setAberto(false)}>
          <div role="dialog" aria-modal="true" aria-label={nome} onClick={e => e.stopPropagation()}
            className="w-full max-w-sm space-y-4 rounded-t-2xl border border-line bg-surface p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:rounded-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><p className="flex items-center gap-2 text-sm text-muted"><span aria-hidden className="size-2.5 rounded-full" style={{ background: cor }} />
                {ehCategoria(o.categoria) ? CATEGORIAS[o.categoria].rotulo : 'Agenda'} · {o.recorrente ? 'toda semana' : 'só um dia'}</p>
                <h2 className="text-lg font-semibold">{nome}</h2>
                <p className="text-sm text-muted">{fmtData(o.inicio)} · {hora(o.ini)}–{hora(o.fim)}</p></div>
              <button type="button" onClick={() => setAberto(false)} aria-label="Fechar" className="p-2 text-muted">✕</button>
            </div>
            <div className="flex flex-col gap-2">
              <button type="button" disabled={pend} onClick={() => agir(() => liberarHorario(o.id!, o.inicio!), `Horário liberado em ${fmtData(o.inicio)}: "${nome}".`)}
                className="min-h-12 rounded-xl bg-brand px-4 font-medium text-black disabled:opacity-50">{o.recorrente ? `Liberar só em ${fmtData(o.inicio)}` : 'Liberar este horário'}</button>
              {o.recorrente && <button type="button" disabled={pend} onClick={() => agir(() => excluirHorarioDaAgenda(o.id!), `"${nome}" saiu da agenda (todas as semanas).`)}
                className="min-h-12 rounded-xl border border-danger px-4 text-danger hover:bg-danger/10 disabled:opacity-50">Excluir de todas as semanas</button>}
              <button type="button" onClick={() => setAberto(false)} className="min-h-12 rounded-xl border border-line px-4">Cancelar</button>
            </div>
            <p className="text-xs text-muted">Liberar não mexe no seu estudo: só deixa esse horário livre na agenda (e o tempo livre do dia é recalculado).</p>
          </div>
        </div>)}
    </>)
}
