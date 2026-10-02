'use client'
import './globals.css'

/** Último recurso: um erro no próprio esqueleto do app (nem o menu carrega). Fica com visual simples, no mesmo tema escuro. */
export default function ErroGlobal({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body className="font-sans antialiased">
        <main className="grid min-h-dvh place-items-center p-6">
          <div role="alert" className="w-full max-w-md space-y-4 rounded-2xl border border-line bg-surface p-8 text-center">
            <h1 className="text-2xl font-semibold">Algo deu errado</h1>
            <p className="text-sm text-muted">O app não conseguiu abrir agora. Os seus dados estão seguros. Confira a conexão e tente de novo.</p>
            <button onClick={reset} className="rounded-xl bg-brand px-5 py-2.5 font-medium text-black">Tentar de novo</button>
          </div>
        </main>
      </body>
    </html>
  )
}
