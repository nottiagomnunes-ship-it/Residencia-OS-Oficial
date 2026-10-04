import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import ImportarBanco from '@/components/banco/ImportarBanco'
import { redirect } from 'next/navigation'
import { ehAdmin, carregarTemas } from '@/lib/banco-data'

/** Ler um PDF com figuras (e guardar as figuras) pode passar dos 10 s padrão do Vercel: até 60 s nas ações desta página. */
export const maxDuration = 60

export default async function ImportarAdmin() {
  const sb = await supabaseServer()
  if (!(await ehAdmin(sb))) redirect('/banco/questoes') // só a conta administradora importa
  const temas = await carregarTemas(sb)
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/admin/questoes" className="text-sm text-muted hover:text-brand">← Questões</Link>
        <h1 className="text-2xl font-semibold">Importar questões</h1>
        <p className="text-muted">PDF ou .docx de questões (com o gabarito no fim, se houver) ou um pacote .json preparado para o app. Nada é gravado antes de você conferir a prévia.</p>
      </div>
      <ImportarBanco admin temasLista={temas} />
    </div>)
}
