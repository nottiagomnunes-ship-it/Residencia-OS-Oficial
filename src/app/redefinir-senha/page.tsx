import { redefinirSenha } from '@/lib/auth'

export default async function RedefinirSenha({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams
  const input = 'w-full rounded-xl border border-line bg-bg px-4 py-3 outline-none focus:border-brand'
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <form action={redefinirSenha} className="w-full max-w-sm space-y-4 rounded-2xl border border-line bg-surface p-8">
        <div><h1 className="text-2xl font-semibold">Criar nova senha</h1><p className="text-sm text-muted">Escolha uma senha nova para a sua conta.</p></div>
        <label className="block space-y-1"><span className="text-sm">Nova senha</span><input name="password" type="password" required minLength={8} autoComplete="new-password" className={input} />
          <span className="block text-xs text-muted">Pelo menos 8 caracteres.</span></label>
        <label className="block space-y-1"><span className="text-sm">Repita a nova senha</span><input name="confirmar" type="password" required minLength={8} autoComplete="new-password" className={input} /></label>
        {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}
        <button className="w-full rounded-xl bg-brand py-3 font-medium text-on-cor">Salvar nova senha</button>
      </form>
    </main>
  )
}
