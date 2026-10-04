import { AREAS, ROTULO_AREA, normalizar, sugerirArea, type Area } from './areas'
import { palavras, temPalavra } from './banco'

/** Um tema da lista geral: área › especialidade › tema. É só etiqueta das questões (não mexe em Matérias nem no plano de ninguém). */
export type Tema = { id: string; area: Area | null; especialidade: string; nome: string; palavras?: string | null } // palavras: palavras-chave separadas por vírgula
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
  const add = (area: Area | null, esp: string, nomeEPalavras: string) => {
    // "Tema: palavra-chave, outra" → nome e palavras-chave (as que ajudam a achar o tema no enunciado)
    const [nomeBruto, ...resto] = nomeEPalavras.split(':')
    esp = esp.trim().slice(0, 80); const nome = nomeBruto.trim().replace(/[.;]+$/, '').slice(0, 120)
    const kws = resto.join(':').split(',').map(x => x.trim()).filter(Boolean).join(', ').slice(0, 500) || null
    if (!esp || !nome) return
    const k = normalizar(esp) + '|' + normalizar(nome)
    if (vistos.has(k)) return
    vistos.add(k); temas.push({ area: area ?? sugerirArea(esp), especialidade: esp, nome, palavras: kws })
  }
  for (const [n, bruta] of texto.split(/\r?\n/).entries()) {
    const linha = bruta.trim()
    if (!linha) continue
    const partes = linha.replace(MARCADOR, '').split(SEP).filter(Boolean)
    if (partes.length >= 3) { const a = lerAreaEscrita(partes[0]); if (a) add(a, partes[1], partes.slice(2).join(' – ')); else add(null, partes[0], partes.slice(1).join(' – ')) }
    else if (partes.length === 2) { const a = lerAreaEscrita(partes[0]); if (a) atual = { area: a, especialidade: partes[1].replace(/:$/, '') }; else add(null, partes[0], partes[1]) }
    else if (MARCADOR.test(bruta)) { if (atual) add(atual.area, atual.especialidade, partes[0]); else avisos.push(`Linha ${n + 1}: "${linha}" sem especialidade antes (escreva um título, como "Anestesiologia", antes da lista).`) }
    else { const t = partes[0].replace(/:\s*$/, ''); atual = { area: null, especialidade: t } }
  }
  return { temas, avisos }
}

/** Agrupa por especialidade (em ordem alfabética), com os temas em ordem: para seletores e para a página da lista. */
export function porEspecialidade<T extends { especialidade: string; nome: string }>(ts: T[]): [string, T[]][] {
  const m = new Map<string, T[]>()
  for (const t of ts) m.set(t.especialidade, [...(m.get(t.especialidade) ?? []), t])
  return [...m].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')).map(([e, l]) => [e, l.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))])
}

/**
 * Sugere o tema de cada questão pelo texto, olhando o lote inteiro:
 *  - palavra-chave do tema (ex.: "rocurônio" em "Bloqueadores neuromusculares") achada no texto vale 2 pontos;
 *  - cada palavra do NOME do tema achada vale 1 ponto, mas só as que distinguem: palavras que aparecem em quase todo o lote
 *    (como "anestesia" num lote de anestesiologia) não contam;
 *  - precisa de 1 palavra-chave, ou de metade das palavras do nome que distinguem. Empate entre temas diferentes: fica sem (você escolhe).
 */
export function sugerirTemas<T extends { id: string; nome: string; palavras?: string | null }>(questoes: { id: string; texto: string }[], temas: T[]): Map<string, T> {
  const textos = questoes.map(q => ({ id: q.id, t: normalizar(q.texto) }))
  const freq = new Map<string, number>(), comum = (w: string) => textos.length >= 20 && (freq.get(w) ?? 0) / textos.length > 0.3
  const todas = new Set(temas.flatMap(t => palavras(t.nome)))
  for (const w of todas) freq.set(w, textos.filter(x => temPalavra(x.t, w)).length)
  const fichas = temas.map(t => ({
    t, nome: palavras(t.nome).filter(w => !comum(w)),
    chaves: (t.palavras ?? '').split(',').map(k => palavras(k)).filter(ws => ws.length),
  }))
  const r = new Map<string, T>()
  for (const q of textos) {
    let melhor: { t: T; nota: number } | null = null, empate = false
    for (const f of fichas) {
      const kw = f.chaves.filter(ws => ws.every(w => temPalavra(q.t, w))).length
      const nm = f.nome.filter(w => temPalavra(q.t, w)).length
      if (!kw && !(nm && nm >= Math.ceil(f.nome.length / 2))) continue
      const nota = kw * 2 + nm
      if (!melhor || nota > melhor.nota) { melhor = { t: f.t, nota }; empate = false } else if (nota === melhor.nota) empate = true
    }
    if (melhor && !empate) r.set(q.id, melhor.t)
  }
  return r
}

/**
 * A lista de temas como texto, uma linha por tema ("Área > Especialidade > Tema: palavras-chave"), no mesmo formato que a lista colada aceita.
 * Serve para mandar a lista ao Claude junto com uma prova: ele classifica cada questão com um tema que já existe.
 */
export function listaDeTemasEmTexto(temas: Tema[]): string {
  const limpo = (s: string) => s.replace(/[›»>;|]/g, '-').replace(/\s+/g, ' ').trim()
  return porEspecialidade(temas).flatMap(([, ts]) => ts.map(t => [t.area ? ROTULO_AREA[t.area] : null, limpo(t.especialidade), limpo(t.nome).replace(/:/g, ' -')]
    .filter(Boolean).join(' > ') + (t.palavras ? `: ${limpo(t.palavras)}` : ''))).join('\n')
}
