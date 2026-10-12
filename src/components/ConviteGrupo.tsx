import Link from 'next/link'
import { cookies } from 'next/headers'
import { esquecerConvite } from '@/lib/grupos'

/** Em Hoje: convite de grupo aberto antes de entrar na conta (o middleware guardou o código num cookie). */
export default async function ConviteGrupo() {
  const convite = (await cookies()).get('convite')?.value
  if (!convite) return null
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-brand/40 bg-brand/10 p-4 text-sm">
      <p>Você recebeu um convite para um grupo de estudo (código <span className="font-mono tracking-widest">{convite}</span>).</p>
      <div className="flex gap-2">
        <Link href={`/grupos?codigo=${convite}`} className="rounded-xl bg-brand px-4 py-2 font-medium text-on-cor">Ver convite</Link>
        <form action={esquecerConvite}><button className="rounded-xl border border-line px-4 py-2">Agora não</button></form>
      </div>
    </div>
  )
}
