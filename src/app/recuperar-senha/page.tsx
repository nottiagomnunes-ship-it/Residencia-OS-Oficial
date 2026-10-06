import Link from 'next/link'
import { pedirRecuperacao } from '@/lib/auth'

export default async function RecuperarSenha({ searchParams }: { searchParams: Promise<{ erro?: string; enviado?: string }> }) {
  const { erro, enviado } = await searchParams
  const input = 'w-full rounded-xl border border-line bg-bg px-4 py-3 outline-none focus:border-brand'
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <form action={pedirRecuperacao} className="w-full max-w-sm space-y-4 rounded-2xl border border-line bg-surface p-8">
        <div><h1 className="text-2xl font-semibold">Esqueci minha senha</h1><p className="text-sm text-muted">Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.</p></div>
        {enviado && <p role="status" className="rounded-xl border border-brand/40 bg-brand/10 p-3 text-sm">Se esse e-mail tiver uma conta, enviamos o link. Confira a caixa de entrada e também o spam. O link vale por pouco tempo.</p>}
        {erro === 'link' && <p role="alert" className="text-sm text-danger">O link expirou ou já foi usado. Peça um novo abaixo.</p>}
        {erro && erro !== 'link' && <p role="alert" className="text-sm text-danger">{erro}</p>}
        <label className="block space-y-1"><span className="text-sm">E-mail</span><input name="email" type="email" required autoComplete="email" className={input} /></label>
        <button className="w-full rounded-xl bg-brand py-3 font-medium text-on-cor">Enviar link</button>
        <p className="text-center text-sm text-muted"><Link href="/login" className="text-brand underline">Voltar para entrar</Link></p>
      </form>
    </main>
  )
}
