'use client'
import { useEffect, useState } from 'react'

/** Campo escondido com o navegador/aparelho de quem envia (ajuda a reproduzir um problema). */
export default function Navegador() {
  const [ua, setUa] = useState('')
  useEffect(() => { setUa(navigator.userAgent.slice(0, 300)) }, [])
  return <input type="hidden" name="navegador" value={ua} />
}
