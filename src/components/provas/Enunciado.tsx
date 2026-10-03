import type { BlocoNaTela } from '@/lib/provas-data'

/** O enunciado da questão: parágrafos e figuras na ordem do arquivo. Figura com fundo branco (gráficos e tabelas costumam ter fundo transparente). */
export function Enunciado({ blocos, numero }: { blocos: BlocoNaTela[]; numero: number }) {
  return (
    <div className="space-y-3 leading-relaxed">
      {blocos.map((b, i) => b.tipo === 'texto'
        ? <p key={i} className="whitespace-pre-line">{b.texto}</p>
        : b.url
          ? <img key={i} src={b.url} alt={`Figura da questão ${numero}`} loading="lazy" className="mx-auto max-h-[70vh] w-auto max-w-full rounded-lg bg-white p-1" />
          : <p key={i} className="rounded-lg border border-dashed border-line p-3 text-center text-sm text-muted">Figura indisponível (o link expirou ou o arquivo foi apagado). Recarregue a página.</p>)}
    </div>)
}
