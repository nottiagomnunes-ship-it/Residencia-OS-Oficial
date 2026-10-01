'use client'
import { useEffect } from 'react'

/** Registra o service worker só em produção (em desenvolvimento ele atrapalharia). */
export default function RegistrarSW() {
  useEffect(() => { if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') navigator.serviceWorker.register('/sw.js').catch(() => {}) }, [])
  return null
}
