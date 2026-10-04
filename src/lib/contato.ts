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

/** Administradora: responde (opcional) e marca como resolvida, ou reabre. */
export async function responderMensagem(fd: FormData) {
  const sb = await supabaseServer()
  const volta = '/admin/mensagens'
  if (!(await ehAdmin(sb))) redirect('/inicio')
  const id = String(fd.get('id') || ''), acao = String(fd.get('acao') || 'resolver'), resposta = String(fd.get('resposta') ?? '').trim().slice(0, 4000)
  const agora = new Date().toISOString()
  const muda = acao === 'reabrir' ? { resolvida_em: null }
    : { resolvida_em: agora, ...(resposta ? { resposta, respondida_em: agora } : {}) }
  const { error } = await sb.from('mensagens').update(muda).eq('id', id)
  if (error) redirect(aviso(volta, 'erro', 'Não foi possível salvar.'))
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
