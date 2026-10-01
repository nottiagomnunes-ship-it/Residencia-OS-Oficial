'use server'
import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { mensagemAuth, validarCadastro, validarSenhaNova } from '@/lib/engine/auth'

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

async function origemDoSite() {
  const h = await headers()
  return `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}`
}

/** Envia o e-mail de recuperação. A resposta é sempre a mesma, exista a conta ou não (não revela quem tem conta). */
export async function pedirRecuperacao(fd: FormData) {
  const email = String(fd.get('email') || '').trim()
  if (!/^\S+@\S+\.\S+$/.test(email)) volta('/recuperar-senha', 'Informe um e-mail válido.')
  // fluxo "implicit": o link do e-mail traz a sessão no # do endereço e não depende do navegador que fez o pedido (funciona com o modelo padrão do e-mail)
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { flowType: 'implicit', persistSession: false, autoRefreshToken: false } })
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${await origemDoSite()}/auth/recuperar` })
  if (error && /rate|too many|seconds/i.test(error.message)) volta('/recuperar-senha', 'Muitos pedidos seguidos. Espere alguns minutos e tente de novo.')
  redirect('/recuperar-senha?enviado=1')
}

/** Define a nova senha (a pessoa chega aqui já autenticada pelo link do e-mail). */
export async function redefinirSenha(fd: FormData) {
  const senha = String(fd.get('password') || ''), confirmar = String(fd.get('confirmar') || '')
  const erro = validarSenhaNova(senha, confirmar)
  if (erro) volta('/redefinir-senha', erro)
  const sb = await supabaseServer()
  const { error } = await sb.auth.updateUser({ password: senha })
  if (error) volta('/redefinir-senha', mensagemAuth(error.message))
  redirect('/inicio')
}
