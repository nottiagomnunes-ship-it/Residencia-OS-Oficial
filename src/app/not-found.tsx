import Link from 'next/link'

export const metadata = { title: 'Página não encontrada · R1TMO' }

/** Endereço que não existe (fora do app ou sem página). Dentro do app, vale a versão com o menu: (app)/not-found.tsx. */
export default function NaoEncontrada() {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-line bg-surface p-8 text-center">
        <p className="text-sm text-muted">Erro 404</p>
        <h1 className="text-2xl font-semibold">Página não encontrada</h1>
        <p className="text-sm text-muted">O endereço pode ter sido digitado errado, ou a página não existe mais. Os seus dados estão seguros.</p>
        <Link href="/inicio" className="inline-block rounded-xl bg-brand px-5 py-2.5 font-medium text-on-cor">Ir para o Início</Link>
      </div>
    </main>)
}
