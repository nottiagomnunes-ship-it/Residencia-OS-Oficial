import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'

async function auth(fd: FormData) {
  'use server'
  const sb = await supabaseServer()
  const creds = { email: String(fd.get('email')), password: String(fd.get('password')) }
  const { error } = fd.get('modo') === 'cadastro' ? await sb.auth.signUp(creds) : await sb.auth.signInWithPassword(creds)
  if (error) redirect('/login?erro=' + encodeURIComponent(error.message))
  redirect('/inicio')
}

export default async function Login({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams
  const input = 'w-full rounded-xl border border-line bg-bg px-4 py-3 outline-none focus:border-brand'
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <form action={auth} className="w-full max-w-sm space-y-4 rounded-2xl border border-line bg-surface p-8">
        <h1 className="text-2xl font-semibold">Residência OS</h1>
        <p className="text-sm text-muted">Entre para ver o que estudar hoje.</p>
        <input name="email" type="email" required placeholder="E-mail" className={input} />
        <input name="password" type="password" required minLength={6} placeholder="Senha (mín. 6 caracteres)" className={input} />
        {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}
        <button name="modo" value="entrar" className="w-full rounded-xl bg-brand py-3 font-medium text-black">Entrar</button>
        <button name="modo" value="cadastro" className="w-full rounded-xl border border-line py-3">Criar conta</button>
      </form>
    </main>
  )
}
