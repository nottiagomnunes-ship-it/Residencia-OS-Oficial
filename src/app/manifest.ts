import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Residência OS', short_name: 'Residência', description: 'Sistema de estudos para residência médica',
    start_url: '/inicio', scope: '/', display: 'standalone', orientation: 'portrait', lang: 'pt-BR',
    background_color: '#0B0F0E', theme_color: '#0B0F0E',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
