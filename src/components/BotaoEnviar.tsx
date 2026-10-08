'use client'
import { useFormStatus } from 'react-dom'

/** Botão de formulário que trava e muda o texto enquanto envia (evita dois toques numa ação demorada). */
export default function BotaoEnviar({ children, enviando, className }: { children: React.ReactNode; enviando: string; className?: string }) {
  const { pending } = useFormStatus()
  return <button disabled={pending} aria-busy={pending} className={`${className ?? ''} disabled:opacity-60`}>{pending ? enviando : children}</button>
}
