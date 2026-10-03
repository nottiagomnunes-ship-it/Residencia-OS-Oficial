import { addDays } from './review'
import { janelasDoDia, hhmmParaMin, type Intervalo } from './compromissos'

/**
 * Agenda pessoal: internato, plantões, academia, aulas, compromissos. Fica SEPARADA do estudo: nunca vira tarefa de estudo, não conta nas horas
 * estudadas nem no XP, e o gerador de cronograma não a lê. Ela só aparece junto (Calendário, Cronograma) e mostra o tempo livre de cada dia.
 */
export const CATEGORIAS = {
  internato: { rotulo: 'Internato', cor: '#3B82F6' },
  plantao: { rotulo: 'Plantão', cor: '#F97316' },
  academia: { rotulo: 'Academia', cor: '#14B8A6' },
  aula: { rotulo: 'Aula ou curso', cor: '#A855F7' },
  compromisso: { rotulo: 'Compromisso', cor: '#EC4899' },
  outro: { rotulo: 'Outro', cor: '#8A9A93' },
} as const
export type Categoria = keyof typeof CATEGORIAS
export const ehCategoria = (v: unknown): v is Categoria => typeof v === 'string' && v in CATEGORIAS
/** Cores que a pessoa pode escolher: legíveis no fundo escuro e sem o verde do estudo nem o vermelho de atrasado. */
export const PALETA_AGENDA = [
  { cor: '#3B82F6', nome: 'Azul' }, { cor: '#0EA5E9', nome: 'Azul-claro' }, { cor: '#06B6D4', nome: 'Ciano' }, { cor: '#14B8A6', nome: 'Verde-água' },
  { cor: '#6366F1', nome: 'Anil' }, { cor: '#A855F7', nome: 'Roxo' }, { cor: '#EC4899', nome: 'Rosa' }, { cor: '#F97316', nome: 'Laranja' },
  { cor: '#EAB308', nome: 'Amarelo' }, { cor: '#8A9A93', nome: 'Cinza' },
] as const
export type CoresAgenda = Partial<Record<Categoria, string>>
const NA_PALETA = new Set<string>(PALETA_AGENDA.map(p => p.cor))
export const corPermitida = (v: unknown): v is string => typeof v === 'string' && NA_PALETA.has(v.toUpperCase())
/** As cores escolhidas (guardadas no perfil): só tipos conhecidos e cores da paleta; o resto é ignorado (volta ao padrão). */
export function lerCores(v: unknown): CoresAgenda {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([k, c]) => ehCategoria(k) && corPermitida(c)).map(([k, c]) => [k, (c as string).toUpperCase()]))
}
/** A cor de um tipo: a escolhida pela pessoa ou a padrão. Tipo desconhecido usa a de "Outro". */
export const corDaCategoria = (c: unknown, cores: CoresAgenda = {}) => {
  const k: Categoria = ehCategoria(c) ? c : 'outro'
  return cores[k] ?? CATEGORIAS[k].cor
}

export const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const

/** Atalhos de um toque: preenchem o formulário (a pessoa ajusta e salva). */
export const MODELOS: readonly { rotulo: string; titulo: string; categoria: Categoria; tipo: 'semanal' | 'pontual'; dias: number[]; ini: string; fim: string }[] = [
  { rotulo: 'Internato · seg a sex, 7h–13h', titulo: 'Internato', categoria: 'internato', tipo: 'semanal', dias: [1, 2, 3, 4, 5], ini: '07:00', fim: '13:00' },
  { rotulo: 'Plantão noturno · 19h–7h', titulo: 'Plantão', categoria: 'plantao', tipo: 'pontual', dias: [], ini: '19:00', fim: '07:00' },
  { rotulo: 'Plantão de 12h · 7h–19h', titulo: 'Plantão', categoria: 'plantao', tipo: 'pontual', dias: [], ini: '07:00', fim: '19:00' },
  { rotulo: 'Academia · seg, qua e sex, 18h–19h', titulo: 'Academia', categoria: 'academia', tipo: 'semanal', dias: [1, 3, 5], ini: '18:00', fim: '19:00' },
  { rotulo: 'Aula · ter e qui, 19h–21h', titulo: 'Aula', categoria: 'aula', tipo: 'semanal', dias: [2, 4], ini: '19:00', fim: '21:00' },
  { rotulo: 'Compromisso · um dia', titulo: '', categoria: 'compromisso', tipo: 'pontual', dias: [], ini: '14:00', fim: '15:00' },
]

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/, ISO = /^\d{4}-\d{2}-\d{2}$/
export type NovoCompromisso = {
  titulo: string; categoria: Categoria; tipo: 'semanal' | 'pontual'; dias: number[]; data: string | null; hora_ini: string; hora_fim: string
  valido_de: string | null; valido_ate: string | null
}

/** Confere o que veio do formulário. "Só um dia" precisa de data; "toda semana", de pelo menos um dia. Fim antes do início = vira a noite. */
export function validarCompromisso(v: Record<string, unknown>): { ok: true; c: NovoCompromisso } | { ok: false; erro: string } {
  const titulo = String(v.titulo ?? '').trim().slice(0, 80)
  if (!titulo) return { ok: false, erro: 'Dê um nome (por exemplo, "Internato", "Academia" ou "Dentista").' }
  const hora_ini = String(v.hora_ini ?? '').slice(0, 5), hora_fim = String(v.hora_fim ?? '').slice(0, 5)
  if (!HORA.test(hora_ini) || !HORA.test(hora_fim)) return { ok: false, erro: 'Informe o horário de início e o de fim.' }
  if (hora_ini === hora_fim) return { ok: false, erro: 'O início e o fim não podem ser iguais. Se passa da meia-noite, use o fim menor (ex.: 19:00 às 07:00).' }
  const tipo = v.tipo === 'pontual' ? 'pontual' : 'semanal'
  const data = String(v.data ?? ''), de = String(v.valido_de ?? ''), ate = String(v.valido_ate ?? '')
  const dias = [...new Set((Array.isArray(v.dias) ? v.dias : []).map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6))].sort()
  if (tipo === 'pontual' && !ISO.test(data)) return { ok: false, erro: 'Escolha a data.' }
  if (tipo === 'semanal' && !dias.length) return { ok: false, erro: 'Marque pelo menos um dia da semana.' }
  if (tipo === 'semanal' && ISO.test(de) && ISO.test(ate) && ate < de) return { ok: false, erro: '"Até" precisa ser depois de "a partir de".' }
  return { ok: true, c: {
    titulo, categoria: ehCategoria(v.categoria) ? v.categoria : 'outro', tipo, hora_ini, hora_fim,
    dias: tipo === 'semanal' ? dias : [], data: tipo === 'pontual' ? data : null,
    valido_de: tipo === 'semanal' && ISO.test(de) ? de : null, valido_ate: tipo === 'semanal' && ISO.test(ate) ? ate : null,
  } }
}

type Pontual = { titulo: string; categoria: string | null; tipo: string; data: string | null; hora_ini: string; hora_fim: string }
const chave = (p: { data: string | null; hora_ini: string; hora_fim: string; titulo: string }) => `${p.data}|${p.hora_ini.slice(0, 5)}|${p.hora_fim.slice(0, 5)}|${p.titulo.trim().toLowerCase()}`
/**
 * A escala muda toda semana: copia os compromissos de UM DIA SÓ da semana anterior para a semana que começa em `segunda` (mesmo dia da semana).
 * Os de "toda semana" já se repetem sozinhos. O que já existe igual na semana de destino não é duplicado.
 */
export function copiarEscala(todos: Pontual[], segunda: string) {
  const de = addDays(segunda, -7), ate = addDays(segunda, -1)
  const existentes = new Set(todos.filter(p => p.tipo === 'pontual' && p.data && p.data >= segunda && p.data <= addDays(segunda, 6)).map(chave))
  return todos.filter(p => p.tipo === 'pontual' && p.data && p.data >= de && p.data <= ate)
    .map(p => ({ titulo: p.titulo, categoria: ehCategoria(p.categoria) ? p.categoria : 'outro', tipo: 'pontual' as const, dias: [] as number[], data: addDays(p.data!, 7),
      hora_ini: p.hora_ini.slice(0, 5), hora_fim: p.hora_fim.slice(0, 5), valido_de: null, valido_ate: null }))
    .filter(n => !existentes.has(chave(n)))
}

/** Tempo livre do dia: a janela em que você está disponível (ex.: 6h–23h) menos a agenda, com a folga de deslocamento em volta. Janelas com menos de 30 min não contam. */
export function livreDoDia(ocup: Intervalo[], janela: { ini: number; fim: number }, folga: number) {
  const janelas = janelasDoDia(janela.ini, janela.fim, ocup, folga)
  return { janelas, minutos: janelas.reduce((s, [a, b]) => s + (b - a), 0) }
}

/** 840 → "14h"; 870 → "14h30"; 1440 → "24h". */
export const horaCurta = (m: number) => `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}`
/** "14h–17h e 20h–22h30". */
export function descreverJanelas(js: [number, number][]) {
  const p = js.map(([a, b]) => `${horaCurta(a)}–${horaCurta(b)}`)
  return p.length <= 1 ? (p[0] ?? '') : `${p.slice(0, -1).join(', ')} e ${p.at(-1)}`
}
/** Total em texto: 300 → "5h"; 330 → "5h30"; 45 → "45 min". */
export const duracaoCurta = (m: number) => (m < 60 ? `${m} min` : horaCurta(m))

/** A janela do perfil (ex.: '06:00:00', '23:00:00'), com padrão seguro se vier vazia ou invertida. */
export function janelaDoPerfil(ini: unknown, fim: unknown) {
  const a = typeof ini === 'string' && /^\d{2}:\d{2}/.test(ini) ? hhmmParaMin(ini) : 360, b = typeof fim === 'string' && /^\d{2}:\d{2}/.test(fim) ? hhmmParaMin(fim) : 1380
  return a < b ? { ini: a, fim: b } : { ini: 360, fim: 1380 }
}

/** Uma linha de "repete quando": "Seg, Qua e Sex · desde 06/10" ou "Só em 07/10". */
export function quando(c: { tipo: string; dias: number[] | null; data: string | null; valido_de: string | null; valido_ate: string | null }) {
  const br = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`
  if (c.tipo === 'pontual') return c.data ? `Só em ${br(c.data)}` : 'Um dia'
  const ds = [...(c.dias ?? [])].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map(d => DIAS_CURTOS[d])
  const lista = ds.length === 7 ? 'Todos os dias' : ds.length <= 1 ? (ds[0] ?? '') : `${ds.slice(0, -1).join(', ')} e ${ds.at(-1)}`
  return [lista, c.valido_de ? `desde ${br(c.valido_de)}` : '', c.valido_ate ? `até ${br(c.valido_ate)}` : ''].filter(Boolean).join(' · ')
}

// ---------- Sugestão de tempo de estudo (só sugere: muda só com um toque seu) ----------

/** As mesmas opções da Minha semana e do Início. */
const OPCOES = [0, 30, 60, 90, 120, 180, 240]
/**
 * Quanto estudar num dia, a partir do tempo livre que a agenda deixa. Usa METADE do livre (o resto fica para deslocamento, comer, descansar
 * depois de plantão...), arredondada para baixo nas opções, no máximo 4h. Com 45 a 59 min livres, sugere 30 min; com menos, nada.
 */
export function sugestaoDeEstudo(livreMin: number) {
  const alvo = Math.max(livreMin / 2, livreMin >= 45 ? 30 : 0)
  return OPCOES.filter(o => o <= Math.min(alvo, 240)).at(-1) ?? 0
}

// ---------- Texto rápido da escala ----------

const DIAS_TEXTO: Record<string, number> = { dom: 0, domingo: 0, seg: 1, segunda: 1, ter: 2, terca: 2, qua: 3, quarta: 3, qui: 4, quinta: 4, sex: 5, sexta: 5, sab: 6, sabado: 6 }
const PISTAS_CATEGORIA: [Categoria, RegExp][] = [
  ['plantao', /\b(plant[aã]o|ps|pronto[ -]socorro|uti|cti|sala vermelha|emerg[eê]ncia|noturno)\b/i],
  ['academia', /\b(academia|treino|muscula[cç][aã]o|corrida|crossfit|pilates|nata[cç][aã]o|futebol|yoga|ioga)\b/i],
  ['aula', /\b(aula|curso|cursinho|liga|palestra|semin[aá]rio|sess[aã]o cl[ií]nica)\b/i],
  ['internato', /\b(internato|enfermaria|ambulat[oó]rio|est[aá]gio|rod[ií]zio|ubs|visita|centro cir[uú]rgico|cc|bloco|maternidade|ala)\b/i],
]
export const categoriaPeloNome = (t: string): Categoria => PISTAS_CATEGORIA.find(([, r]) => r.test(t))?.[0] ?? 'compromisso'

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
/** "7" → 07:00; "7h30" → 07:30; "19:00" → 19:00; "24" → null. */
function lerHora(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})(?:\s*(?:h|:)\s*(\d{2})?)?\s*(?:h|hs|min)?$/i)
  if (!m) return null
  const h = Number(m[1]), mi = Number(m[2] ?? 0)
  return h <= 23 && mi <= 59 ? `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}` : null
}

export type ItemDaEscala = { titulo: string; categoria: Categoria; data: string; hora_ini: string; hora_fim: string }
/**
 * Lê uma escala digitada ou colada, um compromisso por linha ou separados por ";":
 *   "seg 7-13 Enfermaria", "ter 19h–7h PS", "seg a sex 7h às 13h Ambulatório", "seg, qua e sex 18-19 academia", "14/10 14h30-15h Dentista".
 * Os dias da semana caem na semana que começa em `segunda`; datas (dd/mm) valem como escritas. Tudo vira "só um dia" (a escala muda toda semana).
 * O tipo (cor) vem do nome: plantão/PS, enfermaria/ambulatório, academia, aula; o resto é "compromisso".
 */
export function lerEscalaEmTexto(texto: string, segunda: string): { itens: ItemDaEscala[]; erros: string[] } {
  const itens: ItemDaEscala[] = [], erros: string[] = []
  const anoBase = Number(segunda.slice(0, 4)), mesBase = Number(segunda.slice(5, 7))
  for (const bruto of texto.split(/[;\n]+/).map(l => l.trim()).filter(Boolean)) {
    // dias: "seg a sex", "seg, qua e sex", "seg/qua", "segunda-feira" ou datas "14/10"
    const m = bruto.match(/^((?:(?:\d{1,2}\/\d{1,2})|(?:[a-zA-ZÀ-ú]+(?:-feira)?))(?:\s*(?:,|\/|\be\b|\ba\b|\bate\b|\baté\b|-)\s*(?:(?:\d{1,2}\/\d{1,2})|(?:[a-zA-ZÀ-ú]+(?:-feira)?)))*)\s+(.+)$/)
    const horas = m?.[2].match(/^(\d{1,2}(?:\s*[h:]\s*\d{2})?\s*h?)\s*(?:-|–|—|às|as|a|até|ate)\s*(\d{1,2}(?:\s*[h:]\s*\d{2})?\s*h?)\s+(.+)$/i)
    const ini = horas && lerHora(horas[1]), fim = horas && lerHora(horas[2]), titulo = horas?.[3].trim().slice(0, 80)
    if (!m || !horas || !ini || !fim || !titulo) { erros.push(`Não entendi: "${bruto}". Use, por exemplo: seg 7-13 Enfermaria`); continue }
    if (ini === fim) { erros.push(`"${bruto}": início e fim iguais.`); continue }
    const partes = semAcento(m[1]).replace(/-feira/g, '')
    const datas: string[] = []
    const intervalo = partes.match(/^([a-z]+)\s*(?:a|ate|-)\s*([a-z]+)$/)
    if (intervalo && intervalo[1] in DIAS_TEXTO && intervalo[2] in DIAS_TEXTO) {
      const a = (DIAS_TEXTO[intervalo[1]] + 6) % 7, b = (DIAS_TEXTO[intervalo[2]] + 6) % 7   // 0 = segunda
      for (let i = a; i <= (b >= a ? b : b + 7) && i < a + 7; i++) datas.push(addDays(segunda, i % 7))
    } else {
      let ok = true
      for (const p of partes.split(/\s*(?:,|(?<=[a-z])\/(?=[a-z])|\be\b)\s*/).filter(Boolean)) {
        const dm = p.match(/^(\d{1,2})\/(\d{1,2})$/)
        if (dm) {
          const dia = Number(dm[1]), mes = Number(dm[2])
          if (mes < 1 || mes > 12 || dia < 1 || dia > 31) { ok = false; break }
          const ano = mes < mesBase - 6 ? anoBase + 1 : anoBase, d = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
          if (new Date(d + 'T00:00:00Z').toISOString().slice(0, 10) !== d) { ok = false; break }
          datas.push(d)
        } else if (p in DIAS_TEXTO) datas.push(addDays(segunda, (DIAS_TEXTO[p] + 6) % 7))
        else { ok = false; break }
      }
      if (!ok) { erros.push(`"${bruto}": não reconheci o dia. Use seg, ter, qua... ou uma data como 14/10.`); continue }
    }
    for (const data of [...new Set(datas)].sort()) itens.push({ titulo, categoria: categoriaPeloNome(titulo), data, hora_ini: ini, hora_fim: fim })
  }
  return { itens, erros }
}
