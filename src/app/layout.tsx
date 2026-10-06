import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Sora, Figtree, Bricolage_Grotesque } from 'next/font/google'
import RegistrarSW from '@/components/RegistrarSW'
import { cookies } from 'next/headers'
import { lerTamanho } from '@/lib/engine/texto'
import { lerTema, COR_DA_BARRA } from '@/lib/engine/tema'

const sora = Sora({ subsets: ['latin'], variable: '--font-sora', weight: ['500', '600', '700'] })
const figtree = Figtree({ subsets: ['latin'], variable: '--font-figtree' })
// Só para o logo ("R1TMO"): um peso só, para não pesar a página.
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage', weight: '800' })
export const metadata: Metadata = {
  title: 'R1TMO', description: 'Estudos para residência médica no ritmo do seu dia', applicationName: 'R1TMO',
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'R1TMO', statusBarStyle: 'default' },
}
export const viewport: Viewport = { themeColor: [{ media: '(prefers-color-scheme: dark)', color: COR_DA_BARRA.escuro }, { media: '(prefers-color-scheme: light)', color: COR_DA_BARRA.claro }], width: 'device-width', initialScale: 1, minimumScale: 1, viewportFit: 'cover' }

export default async function Root({ children }: { children: React.ReactNode }) {
  const c = await cookies() // escolhas deste aparelho (Configurações → Aparência)
  const texto = lerTamanho(c.get('texto')?.value), tema = lerTema(c.get('tema')?.value)
  return <html lang="pt-BR" className={`${sora.variable} ${figtree.variable} ${bricolage.variable}`} data-texto={texto} data-tema={tema}><body className="font-sans antialiased">{children}<RegistrarSW /></body></html>
}
