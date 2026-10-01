'use client'

export default function Erro({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-md space-y-3 rounded-2xl border border-line bg-surface p-8 text-center">
      <h1 className="text-xl font-semibold">Algo deu errado</h1>
      <p className="text-sm text-muted">A operação não foi concluída e os seus dados não foram alterados pela metade. Confira a conexão e tente de novo.</p>
      <button onClick={reset} className="rounded-xl bg-brand px-4 py-2 font-medium text-black">Tentar de novo</button>
    </div>
  )
}
