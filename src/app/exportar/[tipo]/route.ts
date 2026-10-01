import { supabaseServer } from '@/lib/supabase/server'
import { hojeBR } from '@/lib/dates'
import { lerTabelas } from '@/lib/exportar-data'
import { TABELAS_BACKUP, montarBackup, csvAssuntos, csvQuestoes, csvErros, csvSimulados } from '@/lib/engine/exportar'

const baixar = (corpo: string, nome: string, tipo: string) =>
  new Response(corpo, { headers: { 'Content-Type': `${tipo}; charset=utf-8`, 'Content-Disposition': `attachment; filename="${nome}"`, 'Cache-Control': 'no-store' } })

/** Baixa os dados do próprio usuário: /exportar/backup (JSON completo) ou /exportar/assuntos | questoes | erros | simulados (planilhas CSV). */
export async function GET(_req: Request, { params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return new Response('Entre na sua conta para baixar os dados.', { status: 401 })
  const hoje = hojeBR()
  try {
    if (tipo === 'backup') {
      const [{ data: perfil }, tabelas] = await Promise.all([sb.from('profiles').select('*').eq('id', user.id).single(), lerTabelas(sb, TABELAS_BACKUP)])
      return baixar(JSON.stringify(montarBackup(perfil, tabelas, user.email, new Date().toISOString())), `residencia-os-backup-${hoje}.json`, 'application/json')
    }
    if (tipo === 'assuntos') { const t = await lerTabelas(sb, ['disciplines', 'topics']); return baixar(csvAssuntos(t.disciplines, t.topics), `assuntos-${hoje}.csv`, 'text/csv') }
    if (tipo === 'questoes') { const t = await lerTabelas(sb, ['disciplines', 'topics', 'question_sets']); return baixar(csvQuestoes(t.disciplines, t.topics, t.question_sets), `questoes-${hoje}.csv`, 'text/csv') }
    if (tipo === 'erros') { const t = await lerTabelas(sb, ['disciplines', 'topics', 'error_notebook']); return baixar(csvErros(t.disciplines, t.topics, t.error_notebook), `caderno-de-erros-${hoje}.csv`, 'text/csv') }
    if (tipo === 'simulados') { const t = await lerTabelas(sb, ['mock_exams']); return baixar(csvSimulados(t.mock_exams), `simulados-${hoje}.csv`, 'text/csv') }
    return new Response('Tipo de arquivo desconhecido.', { status: 404 })
  } catch {
    return new Response('Não foi possível gerar o arquivo agora. Tente de novo em instantes.', { status: 500 })
  }
}
