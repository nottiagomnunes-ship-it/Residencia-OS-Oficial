'use client'
import { useEffect, useState } from 'react'

/** Diz se a tela atende a uma consulta de CSS (ex.: tablet deitado). Começa em falso no servidor e acerta logo após carregar. */
export function useMediaQuery(consulta: string) {
  const [ok, setOk] = useState(false)
  useEffect(() => {
    const m = window.matchMedia(consulta), f = () => setOk(m.matches)
    f(); m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [consulta])
  return ok
}
