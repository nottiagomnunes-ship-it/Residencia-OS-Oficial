import Link from 'next/link'
import ImportarProva from '@/components/provas/ImportarProva'

export default function Importar() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/provas" className="text-sm text-muted hover:text-brand">← Provas</Link>
        <h1 className="text-2xl font-semibold">Importar prova</h1>
      </div>
      <ImportarProva />
    </div>)
}
