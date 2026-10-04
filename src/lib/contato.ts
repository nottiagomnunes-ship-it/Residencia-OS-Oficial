'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { ehAdmin } from '@/lib/banco-data'

const TIPOS = ['sugestao', 'problema', 'outro'] as const
const SEM_TABELA = 'Falta atualizar o banco: rode supabase/migrations/0046_mensagens_erros.sql no SQL Editor do Supabase.'
const aviso = (base: string, tipo: 'ok' | 'erro', msg: string) => `${base}${base.includes('?') ? '&' : '?'}${tipo}=${encodeURIComponent(msg)}`

/** Quem usa: envia uma sugestão, um problema ou outra mensagem para a administração (com a página de onde veio, se houver). */
export async function enviarMensagem(fd: FormData) {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  const tipo = String(fd.get('tipo') || '') as (typeof TIPOS)[number], texto = String(fd.get('texto') || '').trim().slice(0, 4000)
  const pagina = String(fd.get('pagina') || '').trim()
  if (!TIPOS.includes(tipo)) redirect(aviso('/contato', 'erro', 'Escolha o tipo da mensagem.'))
  if (texto.length < 3) redirect(aviso('/contato', 'erro', 'Escreva a sua mensagem.'))
  const { error } = await sb.from('mensagens').insert({ tipo, texto, pagina: /^\/[^\s]{0,299}$/.test(pagina) ? pagina : null, navegador: String(fd.get('navegador') || '').slice(0, 300) || null })
  if (error) redirect(aviso('/contato', 'erro', /mensagens/.test(error.message) && /exist|schema/.test(error.message) ? SEM_TABELA : /Muitas mensagens/.test(error.message) ? 'Muitas mensagens em pouco tempo. Tente de novo mais tarde.' : 'Não foi possível enviar. Tente de novo.'))
  revalidatePath('/contato'); revalidatePath('/admin', 'layout')
  redirect(aviso('/contato', 'ok', 'Mensagem enviada. Obrigado! A resposta aparece aqui embaixo.'))
}

export type ResultadoPedido = { ok: true } | { ok: false; erro: string } | { ok: false; jaTem: number }

/**
 * Quem usa: pede que uma prova entre no banco geral (banca, ano e, se tiver, o PDF já enviado ao armazenamento "importacao").
 * Se o banco já tem questões dessa banca e ano, devolve `jaTem` sem gravar, para a pessoa conferir antes (`confirmado` envia mesmo assim).
 */
export async function pedirProva(d: { banca: string; ano?: string | number | null; texto?: string; anexo?: string | null; confirmado?: boolean }): Promise<ResultadoPedido> {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { ok: false, erro: 'Sua sessão expirou. Entre de novo.' }
  const banca = String(d.banca ?? '').replace(/\s+/g, ' ').trim().slice(0, 80)
  const anoTxt = String(d.ano ?? '').trim(), ano = anoTxt ? Number(anoTxt) : null
  const anexo = d.anexo ? String(d.anexo) : null
  if (banca.length < 2) return { ok: false, erro: 'Diga a banca (por exemplo, USP-SP, UNIFESP, ENARE).' }
  if (ano !== null && !(Number.isInteger(ano) && ano >= 1990 && ano <= new Date().getFullYear() + 1)) return { ok: false, erro: 'Confira o ano da prova.' }
  if (anexo && !new RegExp(`^${user.id}/pedidos/[0-9a-f-]{36}\\.pdf$`).test(anexo)) return { ok: false, erro: 'Não consegui ligar o PDF ao pedido. Envie de novo.' }
  if (!d.confirmado) {
    let q = sb.from('banco_questoes').select('id', { count: 'exact', head: true }).ilike('banca', banca.replace(/[%_\\]/g, '\\$&'))
    if (ano) q = q.eq('ano', ano)
    const { count } = await q
    if (count) return { ok: false, jaTem: count }
  }
  const texto = String(d.texto ?? '').trim().slice(0, 4000) || `Pedido de prova: ${banca}${ano ? ` ${ano}` : ''}`
  const { error } = await sb.from('mensagens').insert({ tipo: 'prova', texto: texto.length < 3 ? `Pedido: ${texto}` : texto, banca, ano, anexo })
  if (error) return { ok: false, erro: /tipo_check|banca|anexo|column/.test(error.message) ? 'Falta atualizar o banco: rode supabase/migrations/0047_pedidos_prova.sql no SQL Editor do Supabase.'
    : /Muitas mensagens/.test(error.message) ? 'Muitas mensagens em pouco tempo. Tente de novo mais tarde.' : 'Não foi possível enviar. Tente de novo.' }
  revalidatePath('/contato'); revalidatePath('/admin', 'layout')
  return { ok: true }
}

/** Administradora: responde (opcional) e marca como resolvida, ou reabre. Ao resolver um pedido de prova, o PDF anexado é apagado. */
export async function responderMensagem(fd: FormData) {
  const sb = await supabaseServer()
  const volta = '/admin/mensagens'
  if (!(await ehAdmin(sb))) redirect('/inicio')
  const id = String(fd.get('id') || ''), acao = String(fd.get('acao') || 'resolver'), resposta = String(fd.get('resposta') ?? '').trim().slice(0, 4000)
  const agora = new Date().toISOString()
  const muda = acao === 'reabrir' ? { resolvida_em: null }
    : { resolvida_em: agora, ...(resposta ? { resposta, respondida_em: agora } : {}) }
  let anexo: string | null = null
  if (acao !== 'reabrir') {
    const { data: m } = await sb.from('mensagens').select('anexo').eq('id', id).maybeSingle()
    anexo = (m as { anexo?: string | null } | null)?.anexo ?? null
  }
  const { error } = await sb.from('mensagens').update(anexo ? { ...muda, anexo: null } : muda).eq('id', id)
  if (error) redirect(aviso(volta, 'erro', 'Não foi possível salvar.'))
  if (anexo) await sb.storage.from('importacao').remove([anexo]).then(() => {}, () => {})
  revalidatePath('/admin', 'layout')
  redirect(aviso(volta, 'ok', acao === 'reabrir' ? 'Mensagem reaberta.' : resposta ? 'Resposta enviada e mensagem resolvida.' : 'Mensagem marcada como resolvida.'))
}

/** Administradora: apaga os erros registrados (todos, ou só os de uma mensagem de erro). */
export async function limparErros(fd: FormData) {
  const sb = await supabaseServer()
  if (!(await ehAdmin(sb))) redirect('/inicio')
  const mensagem = String(fd.get('mensagem') || '')
  const q = sb.from('erros_app').delete()
  const { error } = await (mensagem ? q.eq('mensagem', mensagem) : q.gte('criado_em', '1970-01-01'))
  revalidatePath('/admin', 'layout')
  redirect(aviso('/admin/mensagens', error ? 'erro' : 'ok', error ? 'Não foi possível apagar.' : 'Erros apagados.'))
}
