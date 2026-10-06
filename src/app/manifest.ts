import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'R1TMO', short_name: 'R1TMO', description: 'Estudos para residência médica no ritmo do seu dia',
    start_url: '/inicio', scope: '/', display: 'standalone', orientation: 'portrait', lang: 'pt-BR',
    background_color: '#0A0F0D', theme_color: '#0A0F0D',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
