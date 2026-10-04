import { AREAS, ROTULO_AREA, normalizar, sugerirArea, type Area } from './areas'

/** Um tema da lista geral: área › especialidade › tema. É só etiqueta das questões (não mexe em Matérias nem no plano de ninguém). */
export type Tema = { id: string; area: Area | null; especialidade: string; nome: string }
export type TemaNovo = Omit<Tema, 'id'>

const SIGLAS: Record<string, Area> = { cm: 'clinica', clinica: 'clinica', cir: 'cirurgia', ped: 'pediatria', go: 'go', gineco: 'go', prev: 'preventiva', mfc: 'preventiva' }
/** "Clínica Médica", "clinica", "CM", "GO", "Ginecologia e Obstetrícia"... → a área; senão null. */
export function lerAreaEscrita(t: string): Area | null {
  const n = normalizar(t)
  return AREAS.find(a => a === n || normalizar(ROTULO_AREA[a]) === n) ?? SIGLAS[n.replace(/ /g, '')] ?? null
}

const SEP = /\s*(?:›|»|>|;|\|)\s*/
const MARCADOR = /^\s*(?:[-•*–]|\d+[.)])\s+/
/**
 * Lê uma lista de temas colada. Aceita, misturando à vontade:
 *  - "Cirurgia › Anestesiologia › Via aérea difícil" (área › especialidade › tema; também com ">", ";" ou "|")
 *  - "Anestesiologia > Via aérea difícil" (a área vem da especialidade)
 *  - um título "Anestesiologia" (ou "Anestesiologia:") seguido de linhas "- Via aérea difícil"
 * Repetidos (sem ligar para acento e maiúscula) entram uma vez só.
 */
export function lerListaDeTemas(texto: string): { temas: TemaNovo[]; avisos: string[] } {
  const temas: TemaNovo[] = [], avisos: string[] = [], vistos = new Set<string>()
  let atual: { area: Area | null; especialidade: string } | null = null
  const add = (area: Area | null, esp: string, nome: string) => {
    esp = esp.trim().slice(0, 80); nome = nome.trim().replace(/[.;:]+$/, '').slice(0, 120)
    if (!esp || !nome) return
    const k = normalizar(esp) + '|' + normalizar(nome)
    if (vistos.has(k)) return
    vistos.add(k); temas.push({ area: area ?? sugerirArea(esp), especialidade: esp, nome })
  }
  for (const [n, bruta] of texto.split(/\r?\n/).entries()) {
    const linha = bruta.trim()
    if (!linha) continue
    const partes = linha.replace(MARCADOR, '').split(SEP).filter(Boolean)
    if (partes.length >= 3) { const a = lerAreaEscrita(partes[0]); if (a) add(a, partes[1], partes.slice(2).join(' – ')); else add(null, partes[0], partes.slice(1).join(' – ')) }
    else if (partes.length === 2) { const a = lerAreaEscrita(partes[0]); if (a) atual = { area: a, especialidade: partes[1].replace(/:$/, '') }; else add(null, partes[0], partes[1]) }
    else if (MARCADOR.test(bruta)) { if (atual) add(atual.area, atual.especialidade, partes[0]); else avisos.push(`Linha ${n + 1}: "${linha}" sem especialidade antes (escreva um título, como "Anestesiologia", antes da lista).`) }
    else { const t = partes[0].replace(/:$/, ''); atual = { area: null, especialidade: t } }
  }
  return { temas, avisos }
}

/** Agrupa por especialidade (em ordem alfabética), com os temas em ordem: para seletores e para a página da lista. */
export function porEspecialidade<T extends { especialidade: string; nome: string }>(ts: T[]): [string, T[]][] {
  const m = new Map<string, T[]>()
  for (const t of ts) m.set(t.especialidade, [...(m.get(t.especialidade) ?? []), t])
  return [...m].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')).map(([e, l]) => [e, l.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))])
}
