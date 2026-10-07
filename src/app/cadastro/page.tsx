import Link from 'next/link'
import { headers } from 'next/headers'
import Marca from '@/components/Marca'
import { cadastrar } from '@/lib/auth'
import EntrarComGoogle from '@/components/EntrarComGoogle'

export default async function Cadastro({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams
  const input = 'w-full rounded-xl border border-line bg-bg px-4 py-3 outline-none focus:border-brand'
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-line bg-surface p-8">
        <div className="space-y-2"><Marca /><h1 className="text-2xl font-semibold">Criar conta</h1><p className="text-sm text-muted">Leva menos de um minuto. Depois você monta o seu plano de estudos.</p></div>
        {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}
        <EntrarComGoogle navegador={(await headers()).get('user-agent')} />
        <form action={cadastrar} className="space-y-4">
        <label className="block space-y-1"><span className="text-sm">E-mail</span><input name="email" type="email" required autoComplete="email" className={input} /></label>
        <label className="block space-y-1"><span className="text-sm">Senha</span><input name="password" type="password" required minLength={8} autoComplete="new-password" className={input} />
          <span className="block text-xs text-muted">Pelo menos 8 caracteres.</span></label>
        <label className="block space-y-1"><span className="text-sm">Repita a senha</span><input name="confirmar" type="password" required minLength={8} autoComplete="new-password" className={input} /></label>
        <button className="w-full rounded-xl bg-brand py-3 font-medium text-on-cor">Criar conta</button>
        </form>
        <p className="text-center text-xs text-muted">Ao criar a conta (com e-mail ou com o Google), você concorda com os <Link href="/termos" className="underline hover:text-brand">Termos de uso</Link> e a <Link href="/privacidade" className="underline hover:text-brand">Política de privacidade</Link>.</p>
        <p className="text-center text-sm text-muted">Já tem conta? <Link href="/login" className="text-brand underline">Entrar</Link></p>
      </div>
    </main>
  )
}
