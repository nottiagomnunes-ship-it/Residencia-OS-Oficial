'use client'
import { useRef, useState } from 'react'
import { interpretarGesto } from '@/lib/engine/gestos'

type Props = { children: React.ReactNode; direita?: string; esquerda?: string; onDireita?: () => void; onEsquerda?: () => void; className?: string }

/**
 * Deixa uma tarefa "deslizável" no toque: para a direita (rótulo `direita`) e para a esquerda (rótulo `esquerda`).
 * Um sentido sem rótulo fica desligado. A rolagem vertical continua normal, e o mouse não é afetado (no computador valem os botões e o arrastar).
 * Depois de um gesto, o toque que o navegador dispara em seguida é ignorado, para não abrir a tarefa nem seguir um link sem querer.
 */
export default function Deslizavel({ children, direita, esquerda, onDireita, onEsquerda, className = '' }: Props) {
  const [dx, setDx] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const est = useRef<{ x: number; y: number; ativo: boolean } | null>(null)
  const arrastou = useRef(false)
  const largura = () => ref.current?.offsetWidth ?? 300
  const reset = () => { est.current = null; setDx(0) }
  if (!direita && !esquerda) return <>{children}</>
  return (
    <div ref={ref} className={`relative overflow-hidden rounded-lg ${className}`}>
      {dx > 0 && direita && <div aria-hidden className="absolute inset-0 flex items-center bg-brand/25 pl-4 text-sm font-medium text-brand">{direita}</div>}
      {dx < 0 && esquerda && <div aria-hidden className="absolute inset-0 flex items-center justify-end bg-info/25 pr-4 text-sm font-medium text-info">{esquerda}</div>}
      <div style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? 'none' : 'transform .15s ease-out', touchAction: 'pan-y' }}
        onPointerDown={e => { if (e.pointerType === 'mouse') return; est.current = { x: e.clientX, y: e.clientY, ativo: false }; arrastou.current = false }}
        onPointerMove={e => {
          const s = est.current; if (!s) return
          const mx = e.clientX - s.x, my = e.clientY - s.y
          if (!s.ativo) {
            if (Math.abs(my) > 12 && Math.abs(my) >= Math.abs(mx)) { est.current = null; return }       // é rolagem: deixa o navegador rolar
            if (Math.abs(mx) < 12) return
            s.ativo = true; e.currentTarget.setPointerCapture?.(e.pointerId)
          }
          arrastou.current = true
          const permitido = mx > 0 ? !!direita : !!esquerda
          setDx(permitido ? Math.max(-140, Math.min(140, mx)) : 0)
        }}
        onPointerUp={e => {
          const s = est.current; est.current = null
          if (!s?.ativo) { setDx(0); return }
          const g = interpretarGesto(e.clientX - s.x, e.clientY - s.y, largura())
          setDx(0)
          if (g === 'direita' && direita) onDireita?.(); else if (g === 'esquerda' && esquerda) onEsquerda?.()
        }}
        onPointerCancel={reset}
        onClickCapture={e => { if (arrastou.current) { e.preventDefault(); e.stopPropagation(); arrastou.current = false } }}>
        {children}
      </div>
    </div>)
}
