'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { definirArea } from '@/lib/areas'
import { AREAS, ROTULO_AREA, lerArea, type Area } from '@/lib/engine/areas'
import { useAvisos } from '@/components/Avisos'
import { inputCls } from '@/components/ui'

/** A área de UMA disciplina, na página dela. Muda e salva na hora; se não conseguir salvar, volta ao que estava e avisa. */
export default function AreaDaDisciplina({ id, area }: { id: string; area: Area | null }) {
  const router = useRouter(), { mostrar } = useAvisos(), [valor, setValor] = useState<string>(area ?? ''), [pend, start] = useTransition()
  const mudar = (v: string) => {
    const antes = valor; setValor(v)
    start(async () => {
      const r = await definirArea(id, lerArea(v))
      if (r.ok) { mostrar({ tipo: 'ok', conteudo: v ? `Área: ${ROTULO_AREA[v as Area]}.` : 'Área removida.', duracao: 4000 }); router.refresh() }
      else { setValor(antes); mostrar({ tipo: 'erro', conteudo: r.erro ?? 'Não foi possível salvar.' }) }
    })
  }
  return (
    <label className="inline-flex items-center gap-2 text-sm text-muted">Área da prova
      <select value={valor} onChange={e => mudar(e.target.value)} disabled={pend} aria-label="Área da prova" className={inputCls}>
        <option value="">Sem área</option>{AREAS.map(a => <option key={a} value={a}>{ROTULO_AREA[a]}</option>)}
      </select>
    </label>)
}
