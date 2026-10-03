'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { definirCorDaCategoria, restaurarCoresDaAgenda } from '@/lib/agenda'
import { CATEGORIAS, PALETA_AGENDA, corDaCategoria, type Categoria, type CoresAgenda } from '@/lib/engine/agenda'
import { useAvisos } from '@/components/Avisos'

/** Cores por tipo de compromisso: um toque na amostra muda a cor de todos daquele tipo (Agenda, Calendário e Cronograma). */
export default function CoresAgenda({ cores: iniciais, disponivel }: { cores: CoresAgenda; disponivel: boolean }) {
  const [cores, setCores] = useState<CoresAgenda>(iniciais), [, start] = useTransition()
  const router = useRouter(), { mostrar } = useAvisos()
  const escolher = (c: Categoria, cor: string) => {
    const antes = cores
    setCores(x => ({ ...x, [c]: cor }))
    start(async () => {
      const r = await definirCorDaCategoria(c, cor).catch(() => ({ ok: false, erro: undefined }))
      if (!r.ok) { setCores(antes); mostrar({ tipo: 'erro', conteudo: r.erro ?? 'Não foi possível salvar a cor. Tente de novo.' }) } else router.refresh()
    })
  }
  const restaurar = () => start(async () => { const r = await restaurarCoresDaAgenda(); if (r.ok) { setCores({}); router.refresh() } })
  const mudou = Object.keys(cores).length > 0
  return (
    <details className="rounded-2xl border border-line bg-surface p-5">
      <summary className="cursor-pointer font-medium">Cores</summary>
      <div className="mt-3 space-y-4">
        {!disponivel && <p className="text-sm text-warn">Para guardar suas cores, rode <code>supabase/migrations/0030_cores_da_agenda.sql</code> no Supabase.</p>}
        {(Object.keys(CATEGORIAS) as Categoria[]).map(c => {
          const atual = corDaCategoria(c, cores)
          return (
            <fieldset key={c} className="space-y-2">
              <legend className="flex items-center gap-2 text-sm"><span aria-hidden className="size-3 rounded-full" style={{ background: atual }} />{CATEGORIAS[c].rotulo}</legend>
              <div className="flex flex-wrap gap-2">{PALETA_AGENDA.map(p => (
                <button key={p.cor} type="button" disabled={!disponivel} onClick={() => escolher(c, p.cor)} aria-pressed={atual === p.cor}
                  aria-label={`${CATEGORIAS[c].rotulo}: ${p.nome}`} title={p.nome}
                  className={`size-9 rounded-full border-2 disabled:opacity-40 ${atual === p.cor ? 'border-white' : 'border-transparent'}`} style={{ background: p.cor }} />))}</div>
            </fieldset>)
        })}
        {mudou && <button type="button" onClick={restaurar} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:border-brand">Voltar às cores padrão</button>}
      </div>
    </details>)
}
