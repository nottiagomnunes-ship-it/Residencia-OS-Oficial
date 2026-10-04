import { SEM_ASSUNTO } from '@/lib/engine/banco'
import { porEspecialidade, type Tema } from '@/lib/engine/temas'

/**
 * As opções do filtro "Assunto": os temas da lista geral que têm questões (agrupados por especialidade, com quantas questões),
 * os nomes de assunto das questões ainda sem tema e "Sem assunto". Tema vai como "tema:<id>".
 */
export default function OpcoesDeAssunto({ questoes, temas, disciplina = null }: {
  questoes: { tema_id?: string | null; assunto: string | null; discipline_id?: string | null }[]; temas: Tema[]; disciplina?: string | null
}) {
  const qs = questoes.filter(q => !disciplina || q.discipline_id === disciplina)
  const nTema = new Map<string, number>(), nRotulo = new Map<string, number>()
  let sem = 0
  for (const q of qs) {
    if (q.tema_id) nTema.set(q.tema_id, (nTema.get(q.tema_id) ?? 0) + 1)
    else if (q.assunto) nRotulo.set(q.assunto, (nRotulo.get(q.assunto) ?? 0) + 1)
    else sem++
  }
  const grupos = porEspecialidade(temas.filter(t => nTema.has(t.id)))
  const rotulos = [...nRotulo].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
  return (
    <>
      {grupos.map(([esp, ts]) => <optgroup key={esp} label={esp}>{ts.map(t => <option key={t.id} value={`tema:${t.id}`}>{t.nome} ({nTema.get(t.id)})</option>)}</optgroup>)}
      {rotulos.length > 0 && (grupos.length
        ? <optgroup label="Outros assuntos">{rotulos.map(([a, n]) => <option key={a} value={a}>{a} ({n})</option>)}</optgroup>
        : rotulos.map(([a, n]) => <option key={a} value={a}>{a} ({n})</option>))}
      {sem > 0 && <option value={SEM_ASSUNTO}>Sem assunto ({sem})</option>}
    </>)
}
