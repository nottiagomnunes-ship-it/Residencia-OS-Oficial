import { MOTIVOS, aproveitamento, type Motivo } from './questoes'

export const TABELAS_BACKUP = ['disciplines', 'topics', 'topic_tasks', 'review_tasks', 'etapa_modelos', 'study_sessions', 'reviews', 'question_sets', 'question_answers',
  'error_notebook', 'schedule_items', 'mock_exams', 'goals', 'achievements', 'daily_stats', 'commitments', 'capacidade_dia'] as const
type Linha = Record<string, any>
const sem = (o: Linha, chaves: string[]) => Object.fromEntries(Object.entries(o).filter(([k]) => !chaves.includes(k)))

/** Backup completo em JSON: configurações do perfil + todas as tabelas do usuário (sem o id da conta). */
export function montarBackup(perfil: Linha | null, tabelas: Record<string, Linha[]>, email: string | undefined, quando: string) {
  return {
    app: 'Residência OS', versao: 1, exportado_em: quando, conta: email ?? null,
    perfil: perfil ? sem(perfil, ['id']) : null,
    contagem: Object.fromEntries(Object.entries(tabelas).map(([k, v]) => [k, v.length])),
    tabelas: Object.fromEntries(Object.entries(tabelas).map(([k, v]) => [k, v.map(r => sem(r, ['user_id']))])),
  }
}

/** AAAA-MM-DD (ou data com hora) → DD/MM/AAAA. */
export const dataBR = (iso?: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '')

/** Uma célula de CSV para o Excel em português: vírgula decimal, aspas quando preciso e proteção contra fórmulas (=, +, -, @). */
export function celula(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não'
  if (typeof v === 'number') return String(v).replace('.', ',')
  let s = String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
/** CSV com ";" como separador, quebra de linha do Windows e BOM (o Excel abre com acentos corretos). */
export const paraCsv = (colunas: string[], linhas: unknown[][]) => '\uFEFF' + [colunas, ...linhas].map(l => l.map(celula).join(';')).join('\r\n') + '\r\n'

const STATUS: Record<string, string> = { nao_iniciado: 'Não iniciado', planejado: 'Planejado', em_andamento: 'Em andamento', concluido: 'Concluído' }
const PRIORIDADE = ['', 'Alta', 'Média', 'Baixa'], NIVEL = ['', 'Fácil', 'Médio', 'Difícil']
const nomes = (l: Linha[]) => new Map(l.map(x => [x.id, x.nome as string]))

export function csvAssuntos(disciplinas: Linha[], topicos: Linha[]) {
  const d = nomes(disciplinas)
  const ord = [...topicos].sort((a, b) => (a.ordem ?? 1e9) - (b.ordem ?? 1e9) || String(a.nome).localeCompare(String(b.nome)))
  return paraCsv(['Disciplina', 'Subcategoria', 'Assunto', 'Semana ou grupo', 'Status', 'Prioridade', 'Dificuldade', 'Data planejada', 'Data de conclusão'],
    ord.map(t => [d.get(t.discipline_id), t.subcategoria, t.nome, t.grupo, STATUS[t.status] ?? t.status, PRIORIDADE[t.prioridade], NIVEL[t.dificuldade], dataBR(t.planned_date), dataBR(t.completed_date)]))
}
export function csvQuestoes(disciplinas: Linha[], topicos: Linha[], sessoes: Linha[]) {
  const d = nomes(disciplinas), t = nomes(topicos)
  const ord = [...sessoes].sort((a, b) => String(b.realizado_em).localeCompare(String(a.realizado_em)))
  return paraCsv(['Data', 'Disciplina', 'Assunto', 'Banca', 'Prova', 'Ano', 'Questões', 'Acertos', 'Erros', 'Aproveitamento (%)', 'Tempo (min)', 'Dificuldade'],
    ord.map(q => [dataBR(q.realizado_em), d.get(q.discipline_id), t.get(q.topic_id), q.banca, q.prova, q.ano, q.total, q.acertos, q.total - q.acertos, aproveitamento(q.acertos, q.total), q.tempo_min, NIVEL[q.dificuldade] ?? '']))
}
export function csvErros(disciplinas: Linha[], topicos: Linha[], erros: Linha[]) {
  const d = nomes(disciplinas), t = nomes(topicos)
  const ord = [...erros].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  return paraCsv(['Registrado em', 'Disciplina', 'Assunto', 'Motivo', 'Questão', 'Comentário', 'Revisar em', 'Já revisado'],
    ord.map(e => [dataBR(e.created_at), d.get(e.discipline_id), t.get(e.topic_id), MOTIVOS[e.motivo as Motivo]?.rotulo ?? e.motivo, e.enunciado, e.comentario, dataBR(e.revisar_em), !!e.revisado]))
}
export function csvSimulados(simulados: Linha[]) {
  const ord = [...simulados].sort((a, b) => String(b.data).localeCompare(String(a.data)))
  return paraCsv(['Data', 'Simulado', 'Questões', 'Acertos', 'Aproveitamento (%)', 'Tempo (min)'],
    ord.map(s => [dataBR(s.data), s.nome, s.total, s.acertos, aproveitamento(s.acertos, s.total), s.tempo_min]))
}
