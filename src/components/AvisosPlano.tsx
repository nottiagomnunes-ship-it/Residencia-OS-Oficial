import Link from 'next/link'
import { gerarCronogramaAction } from '@/lib/schedule'
import { dispensarAvisoSemana } from '@/lib/capacidade'
import { addDays } from '@/lib/engine/review'

const curta = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`

/** Dois lembretes: o tempo da semana ainda não foi informado, e o tempo mudou depois da última vez que o cronograma foi gerado. */
export function AvisosPlano({ desatualizado, semana, semanaAtual }: { desatualizado: boolean; semana: string | null; semanaAtual: boolean }) {
  if (!desatualizado && !semana) return null
  return (
    <div className="mb-6 space-y-3">
      {semana && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-info/40 bg-info/10 p-4 text-sm">
          <p className="font-medium">{semanaAtual ? 'Você ainda não informou o tempo desta semana' : 'Defina o tempo de estudo da próxima semana'} <span className="font-normal text-muted">({curta(semana)} a {curta(addDays(semana, 6))})</span></p>
          <div className="flex gap-2">
            <Link href="/semana" className="rounded-lg bg-brand px-3 py-1.5 font-medium text-on-cor">Definir agora</Link>
            <form action={dispensarAvisoSemana.bind(null, semana)}><button className="rounded-lg border border-line px-3 py-1.5 hover:border-brand">Agora não</button></form>
          </div>
        </div>)}
      {desatualizado && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warn/40 bg-warn/10 p-4 text-sm">
          <p className="font-medium">O tempo da semana mudou. <span className="font-normal text-muted">Atualize o cronograma para o plano acompanhar.</span></p>
          <form action={gerarCronogramaAction}><button className="rounded-lg bg-brand px-3 py-1.5 font-medium text-on-cor">Atualizar cronograma</button></form>
        </div>)}
    </div>)
}
