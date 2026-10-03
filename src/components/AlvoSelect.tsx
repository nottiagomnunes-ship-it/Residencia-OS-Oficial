import { inputCls } from '@/components/ui'
import { lerArea, ordenarPorArea, rotuloComArea } from '@/lib/engine/areas'

/** Uma escolha só: a disciplina inteira ("geral") ou um assunto específico, agrupado por disciplina. As disciplinas vêm na ordem das áreas, com a área na frente ("Clínica · Cardiologia"). */
export function AlvoSelect({ ds, ts, defaultValue = '' }: { ds: { id: string; nome: string; area?: string | null }[]; ts: { id: string; nome: string; discipline_id: string }[]; defaultValue?: string }) {
  const ordenadas = ordenarPorArea(ds.map(d => ({ ...d, area: lerArea(d.area) })))
  return (
    <select name="alvo" required defaultValue={defaultValue} aria-label="Disciplina ou assunto" className={inputCls + ' w-full min-w-0'}>
      <option value="" disabled>Disciplina ou assunto</option>
      {ordenadas.map(d => (
        <optgroup key={d.id} label={rotuloComArea(d.nome, d.area)}>
          <option value={`d:${d.id}`}>{d.nome} (geral)</option>
          {ts.filter(t => t.discipline_id === d.id).map(t => <option key={t.id} value={`t:${t.id}`}>{t.nome}</option>)}
        </optgroup>))}
    </select>
  )
}
