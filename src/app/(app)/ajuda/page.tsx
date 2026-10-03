import { RevisarTutorial } from '@/components/Tutorial'
import BuscaAjuda from '@/components/BuscaAjuda'

export default function Ajuda() {
  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1"><h1 className="text-2xl font-semibold">Ajuda</h1><p className="text-muted">Perguntas frequentes sobre o app.</p></div>
        <RevisarTutorial />
      </div>
      <BuscaAjuda />
    </div>)
}
