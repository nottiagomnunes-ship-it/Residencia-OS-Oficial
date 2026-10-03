/** As 5 grandes áreas da prova de residência. Cada disciplina (Cardiologia, Nefrologia...) pertence a uma delas, ou a nenhuma ("Sem área"). */
export const AREAS = ['clinica', 'cirurgia', 'pediatria', 'go', 'preventiva'] as const
export type Area = (typeof AREAS)[number]

export const ROTULO_AREA: Record<Area, string> = { clinica: 'Clínica Médica', cirurgia: 'Cirurgia', pediatria: 'Pediatria', go: 'Ginecologia e Obstetrícia', preventiva: 'Preventiva' }
export const SIGLA_AREA: Record<Area, string> = { clinica: 'Clínica', cirurgia: 'Cirurgia', pediatria: 'Pediatria', go: 'GO', preventiva: 'Preventiva' }
/** Uma cor discreta por área (pontos e faixas). Sem vermelho: a cor da área não deve parecer um alerta. */
export const COR_AREA: Record<Area, string> = { clinica: '#3B82F6', cirurgia: '#F59E0B', pediatria: '#22C55E', go: '#EC4899', preventiva: '#A855F7' }

export const ehArea = (v: unknown): v is Area => typeof v === 'string' && (AREAS as readonly string[]).includes(v)
/** Qualquer coisa que venha do banco, do navegador ou de um arquivo vira uma área válida ou null. */
export const lerArea = (v: unknown): Area | null => (ehArea(v) ? v : null)

/** Minúsculas, sem acentos e com um espaço entre as palavras: "Ginecologia e Obstetrícia" → "ginecologia e obstetricia". */
export const normalizar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// Palavras que identificam a área. "radical*" casa o começo de uma palavra (cardiolog* → cardiologia); sem "*", a palavra ou expressão inteira.
// A ordem importa: o que é mais específico vem antes ("Cirurgia pediátrica" é Cirurgia; "Neurologia pediátrica" é Pediatria).
// O que é realmente ambíguo (Imunizações, Mastologia...) fica de fora: o app não adivinha, a pessoa escolhe.
const REGRAS: readonly [Area, readonly string[]][] = [
  ['cirurgia', ['cirurgia*', 'cirurgic*', 'trauma*', 'ortoped*', 'urolog*', 'oftalmolog*', 'otorrino*', 'otorrinolaringolog*', 'anestesi*', 'vascular', 'torac*', 'plastica', 'proctolog*', 'coloproctolog*', 'queimad*', 'cabeca e pescoco', 'neurocirurgia']],
  ['go', ['ginecolog*', 'obstetric*', 'go', 'pre natal', 'prenatal', 'puerper*', 'parto*', 'climaterio', 'planejamento familiar', 'saude da mulher', 'reproducao humana']],
  ['pediatria', ['pediatri*', 'neonatolog*', 'puericultur*', 'adolescen*', 'saude da crianca', 'recem nascido', 'lactente*']],
  ['preventiva', ['preventiv*', 'medicina social', 'saude coletiva', 'saude publica', 'epidemiolog*', 'bioestatistic*', 'estatistica', 'sus', 'etica', 'bioetica', 'medicina legal', 'vigilancia*', 'medicina do trabalho', 'saude do trabalhador', 'atencao primaria', 'saude da familia', 'medicina de familia', 'politicas de saude', 'medicina baseada em evidencia']],
  ['clinica', ['clinica', 'medicina interna', 'cardiolog*', 'pneumolog*', 'gastro*', 'hepatolog*', 'nefrolog*', 'endocrin*', 'hematolog*', 'infectolog*', 'reumatolog*', 'neurolog*', 'dermatolog*', 'psiquiatr*', 'saude mental', 'geriatr*', 'saude do idoso', 'intensiv*', 'terapia intensiva', 'toxicolog*', 'oncolog*', 'imunolog*', 'alergolog*', 'semiolog*', 'cuidados paliativos', 'angiolog*', 'nutrolog*', 'fisiatr*', 'emergencias clinicas', 'diabetes', 'hipertensao']],
]
const casa = (texto: string, padrao: string) => (padrao.endsWith('*') ? (' ' + texto).includes(' ' + padrao.slice(0, -1)) : (' ' + texto + ' ').includes(' ' + padrao + ' '))

/** A área mais provável para o nome de uma disciplina, ou null se não houver certeza (aí a pessoa escolhe). */
export function sugerirArea(nome: string): Area | null {
  const t = normalizar(nome)
  if (!t) return null
  for (const [area, padroes] of REGRAS) if (padroes.some(p => casa(t, p))) return area
  return null
}

export type GrupoDeArea<T> = { area: Area | null; rotulo: string; itens: T[] }
/** Agrupa na ordem das 5 áreas, com "Sem área" por último. Área sem nenhum item não aparece. */
export function agruparPorArea<T extends { area: Area | null }>(itens: T[]): GrupoDeArea<T>[] {
  const grupos: GrupoDeArea<T>[] = AREAS.map(a => ({ area: a as Area | null, rotulo: ROTULO_AREA[a], itens: itens.filter(i => i.area === a) }))
  grupos.push({ area: null, rotulo: 'Sem área', itens: itens.filter(i => i.area === null) })
  return grupos.filter(g => g.itens.length > 0)
}

/** Ordena pelas áreas (as sem área vão para o fim), mantendo a ordem de quem é da mesma área. */
export const ordenarPorArea = <T extends { area?: Area | null }>(itens: T[]): T[] => {
  const pos = (a: Area | null | undefined) => (a ? AREAS.indexOf(a) : AREAS.length)
  return itens.map((x, i) => [x, i] as const).sort((a, b) => pos(a[0].area) - pos(b[0].area) || a[1] - b[1]).map(([x]) => x)
}

/** "Clínica · Cardiologia": o nome com a área na frente, para listas de escolha (não repete se o nome já é a área). */
export function rotuloComArea(nome: string, area: Area | null | undefined) {
  if (!area) return nome
  const n = normalizar(nome)
  if (n === normalizar(ROTULO_AREA[area]) || n === normalizar(SIGLA_AREA[area]) || n.includes(normalizar(SIGLA_AREA[area]))) return nome
  return `${SIGLA_AREA[area]} · ${nome}`
}

export type ResumoDeArea = { area: Area | null; rotulo: string; disciplinas: number; total: number; acertos: number; pct: number | null }
/** Questões e acertos somados por área. As 5 áreas sempre aparecem (mesmo sem questões); "Sem área" só se houver questões nelas. */
export function resumoPorArea(disciplinas: { area: Area | null; total: number; acertos: number }[]): ResumoDeArea[] {
  const soma = (area: Area | null): ResumoDeArea => {
    const d = disciplinas.filter(x => x.area === area), total = d.reduce((s, x) => s + x.total, 0), acertos = d.reduce((s, x) => s + x.acertos, 0)
    return { area, rotulo: area ? ROTULO_AREA[area] : 'Sem área', disciplinas: d.length, total, acertos, pct: total ? Math.round((acertos / total) * 100) : null }
  }
  const lista = AREAS.map(a => soma(a)), sem = soma(null)
  return sem.total > 0 ? [...lista, sem] : lista
}

/** A área de menor acerto, só quando a comparação é justa: pelo menos duas áreas com um mínimo de questões cada. */
export function areaDeMenorAcerto(resumos: ResumoDeArea[], minimo = 30): ResumoDeArea | null {
  const base = resumos.filter(r => r.area !== null && r.pct !== null && r.total >= minimo)
  if (base.length < 2) return null
  return base.reduce((m, r) => (r.pct! < m.pct! ? r : m))
}
