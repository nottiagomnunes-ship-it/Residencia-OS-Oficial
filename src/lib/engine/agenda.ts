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
export const corDaCategoria = (c: unknown) => (ehCategoria(c) ? CATEGORIAS[c].cor : CATEGORIAS.outro.cor)

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
