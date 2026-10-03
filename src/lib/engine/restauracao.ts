import { TABELAS_BACKUP } from './exportar'

type Linha = Record<string, any>
export type Backup = { app: string; versao: number; exportado_em?: string | null; conta?: string | null; perfil?: Linha | null; contagem?: Record<string, number>; tabelas: Record<string, Linha[]> }

export const ROTULOS_TABELAS: Record<string, string> = {
  disciplines: 'Disciplinas', topics: 'Assuntos', topic_tasks: 'Etapas dos assuntos', review_tasks: 'Etapas das revisões', etapa_modelos: 'Padrões de etapas',
  study_sessions: 'Sessões de estudo', reviews: 'Revisões', question_sets: 'Sessões de questões', question_answers: 'Respostas de questões',
  error_notebook: 'Caderno de erros', schedule_items: 'Tarefas do calendário', mock_exams: 'Simulados', goals: 'Metas', achievements: 'Conquistas',
  daily_stats: 'Dias de estudo', commitments: 'Agenda pessoal', capacidade_dia: 'Tempo por dia',
}
// tabelas que todo backup já tinha desde que o backup existe; as outras foram criadas depois e podem faltar em arquivos antigos
const OPCIONAIS = ['review_tasks', 'capacidade_dia']
export const OBRIGATORIAS_NO_ARQUIVO = TABELAS_BACKUP.filter(t => !OPCIONAIS.includes(t))
export const LIMITE_LINHAS_TABELA = 200_000
export const LIMITE_LINHAS_TOTAL = 500_000
export const PALAVRA_DE_CONFIRMACAO = 'RESTAURAR'

/** Configurações do perfil que a restauração devolve. Fora daqui, de propósito: e-mail do lembrete e seus avisos (poderiam religar um envio que o sistema desligou), marcas de tela e etiquetas internas. */
export const CAMPOS_DO_PERFIL = ['nome', 'exam_date', 'study_start_date', 'daily_minutes', 'available_weekdays', 'daily_questions_goal', 'review_intervals', 'xp', 'level',
  'adaptive_reviews', 'limite_foco', 'min_questoes', 'janela_ini', 'janela_fim', 'folga_min', 'modelos_semeados', 'ritmo_modo'] as const

// ordem em que as tabelas podem ser criadas (cada uma só depende das anteriores)
export const ORDEM_INSERCAO = ['disciplines', 'topics', 'study_sessions', 'reviews', 'topic_tasks', 'review_tasks', 'mock_exams', 'question_sets', 'question_answers',
  'error_notebook', 'schedule_items', 'etapa_modelos', 'goals', 'achievements', 'commitments', 'daily_stats', 'capacidade_dia'] as const

// coluna -> tabela a que ela se refere (as mesmas ligações que o banco tem)
const LIGACOES: Record<string, Record<string, string>> = {
  topics: { discipline_id: 'disciplines' }, study_sessions: { topic_id: 'topics' }, reviews: { topic_id: 'topics', origem_session_id: 'study_sessions' },
  topic_tasks: { topic_id: 'topics' }, review_tasks: { review_id: 'reviews' },
  question_sets: { discipline_id: 'disciplines', topic_id: 'topics', mock_exam_id: 'mock_exams' }, question_answers: { question_set_id: 'question_sets' },
  error_notebook: { discipline_id: 'disciplines', topic_id: 'topics', question_answer_id: 'question_answers' }, schedule_items: { topic_id: 'topics', review_id: 'reviews' },
}
// ligações que o banco não aceita vazias: sem o "pai", a linha não pode existir
const OBRIGATORIAS: Record<string, string[]> = { topics: ['discipline_id'], reviews: ['topic_id'], topic_tasks: ['topic_id'], review_tasks: ['review_id'], question_answers: ['question_set_id'] }
const SEM_ID = ['daily_stats', 'capacidade_dia'] // chave composta (usuário + data): não têm id

const objeto = (v: unknown): v is Linha => typeof v === 'object' && v !== null && !Array.isArray(v)

export type Validacao =
  | { ok: true; backup: Backup; avisos: string[]; contagem: Record<string, number>; presentes: string[]; ausentes: string[]; ignoradas: string[] }
  | { ok: false; erro: string }

/** Confere se o arquivo é um backup do Residência OS inteiro e utilizável, antes de qualquer coisa ser tocada. */
export function validarBackup(dados: unknown): Validacao {
  const falha = (erro: string): Validacao => ({ ok: false, erro })
  if (!objeto(dados)) return falha('O arquivo não é um backup do Residência OS.')
  if (dados.app !== 'Residência OS') return falha('O arquivo não parece ser um backup do Residência OS.')
  if (!Number.isInteger(dados.versao) || dados.versao < 1) return falha('O arquivo de backup está sem a versão.')
  if (dados.versao > 1) return falha('Este backup foi criado por uma versão mais nova do app. Atualize o app antes de restaurar.')
  if (!objeto(dados.tabelas)) return falha('O arquivo de backup não tem as tabelas de dados.')
  if (dados.perfil != null && !objeto(dados.perfil)) return falha('O perfil do backup está em um formato inválido.')

  const avisos: string[] = [], contagem: Record<string, number> = {}, ignoradas: string[] = []
  let total = 0
  for (const [nome, linhas] of Object.entries(dados.tabelas)) {
    if (!(TABELAS_BACKUP as readonly string[]).includes(nome)) { ignoradas.push(nome); continue }
    if (!Array.isArray(linhas)) return falha(`A tabela "${ROTULOS_TABELAS[nome]}" do backup está em um formato inválido.`)
    if (linhas.length > LIMITE_LINHAS_TABELA) return falha(`A tabela "${ROTULOS_TABELAS[nome]}" tem linhas demais para restaurar.`)
    if (!linhas.every(objeto)) return falha(`A tabela "${ROTULOS_TABELAS[nome]}" do backup tem linhas inválidas.`)
    if (!SEM_ID.includes(nome)) {
      const ids = linhas.map(l => l.id)
      if (ids.some(i => typeof i !== 'string' || !i)) return falha(`A tabela "${ROTULOS_TABELAS[nome]}" do backup tem linhas sem identificador.`)
      if (new Set(ids).size !== ids.length) return falha(`A tabela "${ROTULOS_TABELAS[nome]}" do backup tem linhas repetidas.`)
    }
    contagem[nome] = linhas.length; total += linhas.length
  }
  if (total > LIMITE_LINHAS_TOTAL) return falha('O backup tem linhas demais para restaurar de uma vez.')
  const ausentes = OBRIGATORIAS_NO_ARQUIVO.filter(t => !(t in contagem))
  if (ausentes.length) return falha(`O backup está incompleto. Faltam: ${ausentes.map(t => ROTULOS_TABELAS[t]).join(', ')}.`)
  const opcionaisAusentes = OPCIONAIS.filter(t => !(t in contagem))
  if (opcionaisAusentes.length) avisos.push(`Este backup é de uma versão mais antiga e não tem: ${opcionaisAusentes.map(t => ROTULOS_TABELAS[t]).join(', ')}. O que você tem hoje nessas partes fica como está.`)
  if (ignoradas.length) avisos.push(`Partes desconhecidas do arquivo serão ignoradas: ${ignoradas.join(', ')}.`)
  if (objeto(dados.contagem) && Object.entries(contagem).some(([t, n]) => (dados.contagem as Linha)[t] !== undefined && (dados.contagem as Linha)[t] !== n)) {
    avisos.push('As quantidades registradas no arquivo não batem com o conteúdo: ele pode ter sido editado.')
  }
  const backup: Backup = { app: dados.app, versao: dados.versao, exportado_em: typeof dados.exportado_em === 'string' ? dados.exportado_em : null, conta: typeof dados.conta === 'string' ? dados.conta : null,
    perfil: (dados.perfil as Linha) ?? null, tabelas: Object.fromEntries(Object.keys(contagem).map(t => [t, (dados.tabelas as Record<string, Linha[]>)[t]])) }
  return { ok: true, backup, avisos, contagem, presentes: Object.keys(contagem), ausentes: opcionaisAusentes, ignoradas }
}

export type Preparado = { dados: Record<string, Linha[]>; perfil: Linha | null; descartadas: Record<string, number>; contagem: Record<string, number> }

/**
 * Transforma o backup no que o banco recebe: identificadores NOVOS (assim funciona em qualquer conta, mesmo com a original ainda existindo)
 * e as ligações refeitas para os novos identificadores. Linha cujo "pai" obrigatório não está no backup é descartada (e seus filhos junto);
 * ligação opcional sem o "pai" vira vazia. `user_id` nunca passa: o banco usa o da pessoa logada.
 */
export function prepararRestauracao(backup: Backup, gerarId: () => string = () => crypto.randomUUID()): Preparado {
  const novos: Record<string, Map<string, string>> = {}, dados: Record<string, Linha[]> = {}, descartadas: Record<string, number> = {}, contagem: Record<string, number> = {}
  for (const tabela of ORDEM_INSERCAO) {
    const linhas = backup.tabelas[tabela]
    if (!linhas) continue
    const mapa = (novos[tabela] = new Map()), saida: Linha[] = []
    descartadas[tabela] = 0
    for (const original of linhas) {
      const { user_id: _u, ...l } = original
      let descartar = false
      for (const [coluna, pai] of Object.entries(LIGACOES[tabela] ?? {})) {
        const v = l[coluna]
        if (v == null) { l[coluna] = null; if (OBRIGATORIAS[tabela]?.includes(coluna)) descartar = true; continue }
        const novo = novos[pai]?.get(v)
        if (novo === undefined) { l[coluna] = null; if (OBRIGATORIAS[tabela]?.includes(coluna)) descartar = true } else l[coluna] = novo
      }
      if (descartar) { descartadas[tabela]++; continue }
      if (!SEM_ID.includes(tabela)) { const id = gerarId(); mapa.set(original.id, id); l.id = id }
      saida.push(l)
    }
    dados[tabela] = saida; contagem[tabela] = saida.length
  }
  const perfil = backup.perfil ? Object.fromEntries(CAMPOS_DO_PERFIL.filter(c => c in backup.perfil!).map(c => [c, backup.perfil![c]])) : null
  return { dados, perfil, descartadas: Object.fromEntries(Object.entries(descartadas).filter(([, n]) => n > 0)), contagem }
}

export type LinhaComparacao = { tabela: string; rotulo: string; backup: number | null; atual: number; mudanca: 'igual' | 'menos' | 'mais' | 'fica' }

/** No backup × hoje, tabela a tabela. `fica`: parte que o arquivo não tem (versão antiga) e que a restauração não mexe. */
export function compararContagens(noBackup: Record<string, number>, atuais: Record<string, number>): LinhaComparacao[] {
  return ORDEM_INSERCAO.map(tabela => {
    const b = tabela in noBackup ? noBackup[tabela] : null, a = atuais[tabela] ?? 0
    return { tabela, rotulo: ROTULOS_TABELAS[tabela], backup: b, atual: a, mudanca: b === null ? 'fica' : b === a ? 'igual' : b < a ? 'menos' : 'mais' }
  })
}

/** Avisos que importam antes de confirmar: backup antigo e progresso que seria desfeito. */
export function avisosDaPrevia(p: { exportadoEm: string | null; hoje: string; concluidosBackup: number; concluidosAtual: number }): string[] {
  const avisos: string[] = []
  if (p.exportadoEm) {
    const dias = Math.floor((Date.parse(p.hoje + 'T00:00:00Z') - Date.parse(p.exportadoEm.slice(0, 10) + 'T00:00:00Z')) / 86_400_000)
    if (dias >= 7) avisos.push(`Este backup tem ${dias} dias. Tudo o que você fez depois dele será substituído.`)
  } else avisos.push('Este backup não informa a data em que foi feito.')
  if (p.concluidosBackup < p.concluidosAtual) avisos.push(`O backup tem ${p.concluidosBackup} assuntos concluídos e a sua conta tem ${p.concluidosAtual} hoje: restaurar vai desfazer esse progresso.`)
  return avisos
}
