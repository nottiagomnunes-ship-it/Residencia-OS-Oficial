import './globals.css'
import { Inter } from 'next/font/google'
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
export const metadata = { title: 'Residência OS', description: 'Sistema de estudos para residência médica' }
export default function Root({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR" className={inter.variable}><body className="font-sans antialiased">{children}</body></html>
}
