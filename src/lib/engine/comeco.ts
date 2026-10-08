/** Como a conta nova começa, escolhido no assistente inicial. Qualquer valor estranho vira "pronto" (o padrão). */
export type Comeco = 'pronto' | 'importar' | 'vazio'
export function lerComeco(v: FormDataEntryValue | null | undefined): Comeco {
  return v === 'importar' || v === 'vazio' ? v : 'pronto'
}

/** As disciplinas que o assistente inicial cria numa conta nova (o usuário dá o peso de cada uma). */
export const DISCIPLINAS_PADRAO = ['Clínica Médica', 'Cirurgia', 'Pediatria', 'Ginecologia e Obstetrícia', 'Preventiva', 'Psiquiatria'] as const

/** Estimativa usada quando a pessoa ainda não sabe a data da prova: daqui a um ano (muda depois em Configurações). */
export function estimarProva(hoje: string) {
  const [a, m, d] = hoje.split('-').map(Number)
  const dia = m === 2 && d === 29 ? 28 : d // 29/02 vira 28/02 no ano seguinte
  return `${a + 1}-${String(m).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/** Data da prova do assistente: a informada, se for uma data válida e futura; senão (ou com "ainda não sei"), a estimativa. */
export function dataDaProva(valor: FormDataEntryValue | null, naoSei: boolean, hoje: string) {
  const v = typeof valor === 'string' ? valor.trim() : ''
  if (naoSei || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v)) || v <= hoje) return { data: estimarProva(hoje), estimada: true }
  return { data: v, estimada: false }
}

/** Nome para preencher o assistente: o que já está na conta ou, para quem entrou pelo Google, o nome que veio de lá. */
export function nomeInicial(nomeDoPerfil: string | null | undefined, meta: Record<string, unknown> | null | undefined) {
  const m = meta ?? {}
  const n = [nomeDoPerfil, m.full_name, m.name].find(x => typeof x === 'string' && x.trim())
  return typeof n === 'string' ? n.trim().slice(0, 80) : ''
}
