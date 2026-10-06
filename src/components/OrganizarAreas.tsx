'use client'
import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { aplicarAreas } from '@/lib/areas'
import { AREAS, ROTULO_AREA, lerArea, type Area } from '@/lib/engine/areas'
import { useAvisos } from '@/components/Avisos'
import { inputCls } from '@/components/ui'

export type LinhaDeArea = { id: string; nome: string; area: Area | null; sugerida: Area | null }

/**
 * Coloca as disciplinas nas 5 áreas da prova. As que o app reconhece pelo nome já vêm preenchidas ("sugerida"); a pessoa confere, muda o que quiser
 * e só então aplica. As que o app não reconhece ficam em "Sem área" para a pessoa escolher. Serve também para rever as áreas depois.
 */
export default function OrganizarAreas({ disciplinas }: { disciplinas: LinhaDeArea[] }) {
  const router = useRouter(), { mostrar } = useAvisos(), [pend, start] = useTransition()
  const semArea = disciplinas.filter(d => !d.area).length
  const inicial = () => Object.fromEntries(disciplinas.map(d => [d.id, d.area ?? d.sugerida ?? ''])) as Record<string, string>
  const [aberto, setAberto] = useState(false), [valores, setValores] = useState(inicial)
  useEffect(() => setValores(inicial()), [JSON.stringify(disciplinas)]) // eslint-disable-line react-hooks/exhaustive-deps
  const mudancas = disciplinas.filter(d => (lerArea(valores[d.id]) ?? null) !== d.area)
  const aplicar = () => start(async () => {
    const r = await aplicarAreas(mudancas.map(d => ({ id: d.id, area: lerArea(valores[d.id]) })))
    if (r.ok) { mostrar({ tipo: 'ok', conteudo: `${r.aplicadas} ${r.aplicadas === 1 ? 'disciplina organizada' : 'disciplinas organizadas'} por área.` }); setAberto(false); router.refresh() }
    else mostrar({ tipo: 'erro', conteudo: r.erro ?? 'Não foi possível aplicar. Tente de novo.' })
  })
  if (!disciplinas.length) return null
  return (
    <section aria-label="Áreas da prova" className="space-y-3 rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-medium">Áreas da prova</h2>
          <p className="text-sm text-muted">{semArea ? `${semArea} ${semArea === 1 ? 'disciplina está' : 'disciplinas estão'} sem área.` : 'Todas as disciplinas estão em uma área.'} Clínica Médica, Cirurgia, Pediatria, GO e Preventiva.</p>
        </div>
        <button type="button" onClick={() => setAberto(a => !a)} aria-expanded={aberto} className={`rounded-xl border px-4 py-2 text-sm ${semArea && !aberto ? 'border-brand text-brand' : 'border-line hover:border-brand'}`}>
          {aberto ? 'Fechar' : semArea ? 'Organizar por áreas' : 'Rever áreas'}
        </button>
      </div>
      {aberto && (
        <>
          <p className="text-sm text-muted">As marcadas como “sugerida” foram reconhecidas pelo nome. Confira, mude o que quiser e toque em Aplicar. Se o app não reconheceu uma, ela fica em “Sem área” para você escolher.</p>
          <ul className="divide-y divide-line">
            {disciplinas.map(d => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-sm">{d.nome}{!d.area && d.sugerida && valores[d.id] === d.sugerida && <span className="ml-2 text-xs text-muted">sugerida</span>}</span>
                <select aria-label={`Área de ${d.nome}`} value={valores[d.id] ?? ''} onChange={e => setValores(v => ({ ...v, [d.id]: e.target.value }))} className={inputCls}>
                  <option value="">Sem área</option>{AREAS.map(a => <option key={a} value={a}>{ROTULO_AREA[a]}</option>)}
                </select>
              </li>))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={aplicar} disabled={!mudancas.length || pend} className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-on-cor disabled:opacity-50">
              {pend ? 'Aplicando…' : mudancas.length ? `Aplicar (${mudancas.length})` : 'Nada a aplicar'}
            </button>
            <button type="button" onClick={() => setValores(inicial())} disabled={pend || !mudancas.length} className="rounded-xl border border-line px-4 py-2 text-sm disabled:opacity-50">Desfazer mudanças</button>
          </div>
        </>)}
    </section>)
}
