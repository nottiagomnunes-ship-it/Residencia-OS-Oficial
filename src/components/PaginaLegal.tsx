import Link from 'next/link'
import Marca from '@/components/Marca'
import { VERSAO_TERMOS } from '@/lib/engine/legal'

/** Moldura das páginas públicas de Termos e Privacidade (abrem com ou sem conta). */
export default function PaginaLegal({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6 pb-16">
      <Link href="/" className="inline-flex rounded-lg" aria-label="Voltar ao R1TMO"><Marca tamanho="sm" /></Link>
      <div className="space-y-1"><h1 className="text-2xl font-semibold">{titulo}</h1><p className="text-sm text-muted">Versão de {VERSAO_TERMOS}</p></div>
      <div className="space-y-5 text-sm leading-relaxed [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">{children}</div>
      <p className="border-t border-line pt-4 text-sm text-muted"><Link href="/termos" className="underline hover:text-brand">Termos de uso</Link> · <Link href="/privacidade" className="underline hover:text-brand">Política de privacidade</Link></p>
    </main>)
}
