'use server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { mensagemAuth, validarCadastro } from '@/lib/engine/auth'

function volta(pagina: string, erro: string): never { redirect(`${pagina}?erro=${encodeURIComponent(erro)}`) }

export async function entrar(fd: FormData) {
  const email = String(fd.get('email') || '').trim(), password = String(fd.get('password') || '')
  const sb = await supabaseServer()
  const { error } = await sb.auth.signInWithPassword({ email, password })
  if (error) volta('/login', mensagemAuth(error.message))
  redirect('/inicio')
}

export async function cadastrar(fd: FormData) {
  const email = String(fd.get('email') || '').trim(), senha = String(fd.get('password') || ''), confirmar = String(fd.get('confirmar') || '')
  const erro = validarCadastro(email, senha, confirmar)
  if (erro) volta('/cadastro', erro)
  const h = await headers()
  const origem = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}`
  const sb = await supabaseServer()
  const { data, error } = await sb.auth.signUp({ email, password: senha, options: { emailRedirectTo: `${origem}/login` } })
  if (error) volta('/cadastro', mensagemAuth(error.message))
  if (!data.session) redirect('/login?aviso=confirme') // confirmação de e-mail ligada: falta clicar no link
  redirect('/inicio') // sem confirmação: já entra e o assistente inicial abre
}
