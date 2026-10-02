import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Inter } from 'next/font/google'
import RegistrarSW from '@/components/RegistrarSW'
import { cookies } from 'next/headers'
import { lerTamanho } from '@/lib/engine/texto'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
export const metadata: Metadata = {
  title: 'Residência OS', description: 'Sistema de estudos para residência médica', applicationName: 'Residência OS',
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'Residência OS', statusBarStyle: 'black' },
}
export const viewport: Viewport = { themeColor: '#0B0F0E', width: 'device-width', initialScale: 1, minimumScale: 1, viewportFit: 'cover' }

export default async function Root({ children }: { children: React.ReactNode }) {
  const texto = lerTamanho((await cookies()).get('texto')?.value) // escolha deste aparelho (Configurações → Aparência)
  return <html lang="pt-BR" className={inter.variable} data-texto={texto}><body className="font-sans antialiased">{children}<RegistrarSW /></body></html>
}
