import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import { carregarAreas, comArea } from '@/lib/areas-data'
import ImportarBanco from '@/components/banco/ImportarBanco'

export default async function Importar() {
  const sb = await supabaseServer()
  const [{ data: ds }, { data: ts }, areas] = await Promise.all([
    sb.from('disciplines').select('id,nome').order('ordem'), sb.from('topics').select('id,nome,discipline_id').limit(5000), carregarAreas(sb),
  ])
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/banco" className="text-sm text-muted hover:text-brand">← Banco de questões</Link>
        <h1 className="text-2xl font-semibold">Importar questões</h1>
        <p className="text-muted">PDF ou .docx de questões (com o gabarito no fim, se houver) ou um pacote .json preparado para o app. Nada é gravado antes de você conferir a prévia.</p>
      </div>
      <ImportarBanco disciplinas={comArea(ds ?? [], areas.mapa)} assuntos={ts ?? []} />
    </div>)
}
