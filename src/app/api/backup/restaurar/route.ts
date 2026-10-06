import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { supabaseServer } from '@/lib/supabase/server'
import { hojeBR } from '@/lib/dates'
import { lerArquivoDeBackup, LIMITE_ENVIO } from '@/lib/backup-arquivo'
import { validarBackup, prepararRestauracao, compararContagens, avisosDaPrevia, PALAVRA_DE_CONFIRMACAO } from '@/lib/engine/restauracao'
import { contarAtuais, montarCopiaDeSeguranca } from '@/lib/backup-restauracao-data'
import { PAGINAS_AFETADAS } from '@/lib/backup-paginas'
import { todasAsLinhas } from '@/lib/paginar'

export const runtime = 'nodejs'
export const maxDuration = 60

const resposta = (corpo: object, status = 200) => NextResponse.json(corpo, { status })

/**
 * Restaurar um backup, em duas etapas com o mesmo arquivo:
 *  modo "previa": confere o arquivo e mostra o que mudaria (não altera nada);
 *  modo "restaurar": exige a palavra de confirmação, guarda uma cópia do estado atual e troca os dados numa única transação.
 */
export async function POST(req: Request) {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return resposta({ erro: 'Sua sessão expirou. Entre de novo.' }, 401)

  let form: FormData
  try { form = await req.formData() } catch { return resposta({ erro: 'Não foi possível ler o arquivo enviado.' }, 400) }
  const modo = String(form.get('modo') ?? ''), arquivo = form.get('arquivo')
  if (modo !== 'previa' && modo !== 'restaurar') return resposta({ erro: 'Pedido inválido.' }, 400)
  if (!(arquivo instanceof File) || arquivo.size === 0) return resposta({ erro: 'Escolha o arquivo de backup.' }, 400)
  if (arquivo.size > LIMITE_ENVIO) return resposta({ erro: 'O arquivo é grande demais para enviar.' }, 413)

  const lido = lerArquivoDeBackup(Buffer.from(await arquivo.arrayBuffer()))
  if (!lido.ok) return resposta({ erro: lido.erro }, 400)
  const v = validarBackup(lido.dados)
  if (!v.ok) return resposta({ erro: v.erro }, 422)
  const concluidosBackup = v.backup.tabelas.topics.filter(t => t.status === 'concluido').length

  if (modo === 'previa') {
    const atuais = await contarAtuais(sb)
    return resposta({
      ok: true,
      previa: {
        exportadoEm: v.backup.exportado_em ?? null, conta: v.backup.conta ?? null, linhas: compararContagens(v.contagem, atuais.contagem),
        avisos: [...avisosDaPrevia({ exportadoEm: v.backup.exportado_em ?? null, hoje: hojeBR(), concluidosBackup, concluidosAtual: atuais.concluidos }), ...v.avisos],
        concluidos: { backup: concluidosBackup, atual: atuais.concluidos },
      },
    })
  }

  if (String(form.get('confirmacao') ?? '').trim().toUpperCase() !== PALAVRA_DE_CONFIRMACAO) return resposta({ erro: `Digite ${PALAVRA_DE_CONFIRMACAO} para confirmar.` }, 400)
  const preparado = prepararRestauracao(v.backup)
  // erros ligados a uma questão do banco (0045): o banco de questões não faz parte do backup; se a questão não existe mais, o erro volta sem a ligação
  const erros = (preparado.dados as Record<string, Record<string, unknown>[] | undefined>).error_notebook
  if (erros?.some(e => e.banco_questao_id)) {
    const { data: qs } = await todasAsLinhas((de, ate) => sb.from('banco_questoes').select('id').order('id').range(de, ate), 50000)
    const existe = new Set(((qs ?? []) as { id: string }[]).map(q => q.id))
    for (const e of erros) if (e.banco_questao_id && !existe.has(String(e.banco_questao_id))) e.banco_questao_id = null
  }
  const copia = await montarCopiaDeSeguranca(sb, user)
  const { data, error } = await sb.rpc('restaurar_backup', { p_dados: preparado.dados, p_perfil: preparado.perfil, p_snapshot: copia })
  if (error) return resposta({ erro: 'Não foi possível restaurar. Nada foi alterado.', detalhe: String(error.message).slice(0, 240) }, 500)
  PAGINAS_AFETADAS.forEach(p => revalidatePath(p, 'layout'))
  return resposta({ ok: true, restauradas: data ?? preparado.contagem, descartadas: preparado.descartadas })
}
