import Link from 'next/link'

/** Algo que não existe dentro do app (ex.: um assunto apagado): aparece no meio do app, com o menu ao lado. */
export default function NaoEncontrada() {
  return (
    <div className="mx-auto max-w-md space-y-3 rounded-2xl border border-line bg-surface p-8 text-center">
      <h1 className="text-xl font-semibold">Não encontramos isso</h1>
      <p className="text-sm text-muted">O que você procurou não existe mais ou o endereço está errado. Os seus dados estão seguros.</p>
      <Link href="/inicio" className="inline-block rounded-xl bg-brand px-5 py-2.5 font-medium text-on-cor">Ir para o Início</Link>
    </div>)
}
