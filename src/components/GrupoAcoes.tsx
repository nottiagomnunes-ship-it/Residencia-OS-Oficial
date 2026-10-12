'use client'
import { useState } from 'react'
import { sairDoGrupo } from '@/lib/grupos'

/** Copia o convite (ou abre o compartilhar do celular). */
export function Convidar({ texto }: { texto: string }) {
  const [ok, setOk] = useState(false)
  const copiar = async () => {
    try {
      if (navigator.share) { await navigator.share({ text: texto }); return }
      await navigator.clipboard.writeText(texto); setOk(true); setTimeout(() => setOk(false), 2500)
    } catch { /* cancelado */ }
  }
  return <button type="button" onClick={copiar} className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-on-cor">{ok ? 'Convite copiado' : 'Convidar'}</button>
}

/** Sair pede confirmação na própria tela (sem janela do navegador). */
export function Sair({ grupo, ultimo }: { grupo: string; ultimo: boolean }) {
  const [certeza, setCerteza] = useState(false)
  if (!certeza) return <button type="button" onClick={() => setCerteza(true)} className="text-sm text-danger hover:underline">Sair do grupo</button>
  return (
    <form action={sairDoGrupo} className="flex flex-wrap items-center gap-2 text-sm">
      <input type="hidden" name="grupo" value={grupo} />
      <span>{ultimo ? 'Você é a última pessoa: o grupo será apagado. Sair?' : 'Sair do grupo?'}</span>
      <button className="rounded-lg bg-danger px-3 py-1.5 font-medium text-on-cor">Sair</button>
      <button type="button" onClick={() => setCerteza(false)} className="rounded-lg border border-line px-3 py-1.5">Cancelar</button>
    </form>)
}
