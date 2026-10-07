'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { avisarErro } from '@/lib/avisar-erro'
import { recarregarPagina, recarregarSeVersaoNova } from '@/lib/recarregar'
import { ehErroDeVersao } from '@/lib/engine/versao'

export default function Erro({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  const pagina = usePathname()
  // a administração fica sabendo (Administração → Mensagens); se for só o app que foi atualizado, recarrega sozinho
  useEffect(() => { avisarErro(error); recarregarSeVersaoNova(error) }, [error])
  if (ehErroDeVersao(error.message, error.name)) return <p role="status" className="mx-auto max-w-md rounded-2xl border border-line bg-surface p-8 text-center text-sm text-muted">O app foi atualizado. Abrindo a versão nova… <button onClick={recarregarPagina} className="text-brand underline">Recarregar</button></p>
  return (
    <div role="alert" className="mx-auto max-w-md space-y-3 rounded-2xl border border-line bg-surface p-8 text-center">
      <h1 className="text-xl font-semibold">Algo deu errado</h1>
      <p className="text-sm text-muted">A operação não foi concluída e os seus dados não foram alterados pela metade. Confira a conexão e tente de novo.</p>
      <div className="flex flex-wrap justify-center gap-2">
        <button onClick={recarregarPagina} className="rounded-xl bg-brand px-4 py-2 font-medium text-on-cor">Tentar de novo</button>
        <Link href="/inicio" className="rounded-xl border border-line px-4 py-2 hover:border-brand">Ir para o Início</Link>
      </div>
      <p className="text-xs text-muted">O erro já foi registrado automaticamente. Quer contar o que estava fazendo? <Link href={`/contato?tipo=problema&de=${encodeURIComponent(pagina ?? '')}`} className="text-brand underline">Relatar o problema</Link></p>
    </div>
  )
}
