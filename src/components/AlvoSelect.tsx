import { inputCls } from '@/components/ui'

/** Uma escolha só: a disciplina inteira ("geral") ou um assunto específico, agrupado por disciplina. */
export function AlvoSelect({ ds, ts, defaultValue = '' }: { ds: { id: string; nome: string }[]; ts: { id: string; nome: string; discipline_id: string }[]; defaultValue?: string }) {
  return (
    <select name="alvo" required defaultValue={defaultValue} aria-label="Disciplina ou assunto" className={inputCls}>
      <option value="" disabled>Disciplina ou assunto</option>
      {ds.map(d => (
        <optgroup key={d.id} label={d.nome}>
          <option value={`d:${d.id}`}>{d.nome} (geral)</option>
          {ts.filter(t => t.discipline_id === d.id).map(t => <option key={t.id} value={`t:${t.id}`}>{t.nome}</option>)}
        </optgroup>))}
    </select>
  )
}
