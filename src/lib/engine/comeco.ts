/** Como a conta nova começa, escolhido no assistente inicial. Qualquer valor estranho vira "pronto" (o padrão). */
export type Comeco = 'pronto' | 'importar' | 'vazio'
export function lerComeco(v: FormDataEntryValue | null | undefined): Comeco {
  return v === 'importar' || v === 'vazio' ? v : 'pronto'
}

/** As disciplinas que o assistente inicial cria numa conta nova (o usuário dá o peso de cada uma). */
export const DISCIPLINAS_PADRAO = ['Clínica Médica', 'Cirurgia', 'Pediatria', 'Ginecologia e Obstetrícia', 'Preventiva', 'Psiquiatria'] as const
