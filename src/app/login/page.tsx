import Link from 'next/link'
import { headers } from 'next/headers'
import Marca from '@/components/Marca'
import { entrar } from '@/lib/auth'
import EntrarComGoogle from '@/components/EntrarComGoogle'

export default async function Login({ searchParams }: { searchParams: Promise<{ erro?: string; aviso?: string }> }) {
  const { erro, aviso } = await searchParams
  const input = 'w-full rounded-xl border border-line bg-bg px-4 py-3 outline-none focus:border-brand'
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-line bg-surface p-8">
        <div className="space-y-2"><h1 className="sr-only">R1TMO</h1><Marca tamanho="lg" /><p className="text-sm text-muted">Entre para ver o que estudar hoje.</p></div>
        {aviso === 'confirme' && <p role="status" className="rounded-xl border border-brand/40 bg-brand/10 p-3 text-sm">Conta criada! Enviamos um link de confirmação para o seu e-mail. Clique nele e depois entre aqui.</p>}
        {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}
        <EntrarComGoogle navegador={(await headers()).get('user-agent')} />
        <form action={entrar} className="space-y-4">
        <label className="block space-y-1"><span className="text-sm">E-mail</span><input name="email" type="email" required autoComplete="email" className={input} /></label>
        <label className="block space-y-1"><span className="text-sm">Senha</span><input name="password" type="password" required autoComplete="current-password" className={input} /></label>
        <p className="text-right text-sm"><Link href="/recuperar-senha" className="text-brand underline">Esqueci minha senha</Link></p>
        <button className="w-full rounded-xl bg-brand py-3 font-medium text-on-cor">Entrar</button>
        </form>
        <p className="text-center text-sm text-muted">Ainda não tem conta? <Link href="/cadastro" className="text-brand underline">Criar conta</Link></p>
        <p className="text-center text-xs text-muted"><Link href="/termos" className="underline hover:text-brand">Termos de uso</Link> · <Link href="/privacidade" className="underline hover:text-brand">Privacidade</Link></p>
      </div>
    </main>
  )
}
