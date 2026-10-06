'use client'
import { useMemo, useState } from 'react'
import { salvarEscalaRapida } from '@/lib/agenda'
import { lerEscalaEmTexto, corDaCategoria, CATEGORIAS, DIAS_CURTOS, type CoresAgenda } from '@/lib/engine/agenda'
import { inputCls } from '@/components/ui'

/** Colar ou digitar a escala da semana; a prévia mostra o que vai entrar antes de salvar. */
/** `existentes`: os horários de um dia só que já estão nesta semana (para oferecer substituir em vez de duplicar). */
export default function EscalaRapida({ semana, cores = {}, existentes = [] }: { semana: string; cores?: CoresAgenda; existentes?: { data: string; hora_ini: string; hora_fim: string; titulo: string }[] }) {
  const [texto, setTexto] = useState(''), [modo, setModo] = useState<'substituir' | 'adicionar'>('substituir')
  const r = useMemo(() => (texto.trim() ? lerEscalaEmTexto(texto, semana) : null), [texto, semana])
  const dia = (d: string) => `${DIAS_CURTOS[new Date(d + 'T12:00:00Z').getUTCDay()]} ${d.slice(8)}/${d.slice(5, 7)}`
  return (
    <form action={salvarEscalaRapida} className="space-y-3 rounded-2xl border border-line bg-surface p-5">
      <input type="hidden" name="semana" value={semana} />
      <h2 className="font-medium">Escala em texto</h2>
      <p className="text-sm text-muted">Um por linha (ou separados por ";"). Os dias da semana caem na semana mostrada ao lado.</p>
      <textarea name="texto" rows={4} value={texto} onChange={e => setTexto(e.target.value)} className={inputCls + ' w-full font-mono'}
        placeholder={'seg 7-13 Enfermaria\nter 19-7 PS\nqua a sex 7-13 Ambulatório\nseg, qua e sex 18-19 Academia\n14/10 14h30-15h Dentista'} />
      {existentes.length > 0 && (
        <fieldset className="space-y-2 rounded-xl border border-line p-3 text-sm">
          <legend className="px-1 text-muted">Esta semana já tem {existentes.length} {existentes.length === 1 ? 'horário de um dia só' : 'horários de um dia só'}</legend>
          <label className="flex items-start gap-2"><input type="radio" name="modo" value="substituir" checked={modo === 'substituir'} onChange={() => setModo('substituir')} className="mt-1 accent-brand" />
            <span>Substituir a escala desta semana<span className="block text-xs text-muted">Os horários de um dia só desta semana saem e entram os novos. Os de "toda semana" (academia...) ficam.</span></span></label>
          <label className="flex items-start gap-2"><input type="radio" name="modo" value="adicionar" checked={modo === 'adicionar'} onChange={() => setModo('adicionar')} className="mt-1 accent-brand" />
            <span>Adicionar ao que já existe<span className="block text-xs text-muted">O que já estiver igual (mesmo dia, horário e nome) não é repetido.</span></span></label>
          {modo === 'substituir' && <details><summary className="cursor-pointer text-xs text-muted">Ver o que sai</summary>
            <ul className="mt-1 space-y-0.5 text-xs text-muted">{existentes.map((e, k) => <li key={k}>{dia(e.data)} {e.hora_ini.slice(0, 5)}–{e.hora_fim.slice(0, 5)} {e.titulo}</li>)}</ul></details>}
        </fieldset>)}
      {r && <div className="space-y-2 text-sm">
        {r.itens.length > 0 && <ul className="space-y-1">{r.itens.map((i, k) => (
          <li key={k} className="flex items-center gap-2"><span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: corDaCategoria(i.categoria, cores) }} />
            <span className="w-20 shrink-0 text-muted">{dia(i.data)}</span><span className="w-24 shrink-0">{i.hora_ini}–{i.hora_fim}</span>
            <span className="min-w-0 flex-1 truncate">{i.titulo} <span className="text-xs text-muted">· {CATEGORIAS[i.categoria].rotulo}</span></span></li>))}</ul>}
        {r.erros.map((e, k) => <p key={k} className="text-warn">{e}</p>)}
      </div>}
      <button disabled={!r?.itens.length} className="w-full rounded-xl bg-brand px-4 py-3 font-medium text-on-cor disabled:opacity-50">
        {r?.itens.length ? (existentes.length && modo === 'substituir' ? `Substituir a semana (${r.itens.length} ${r.itens.length === 1 ? 'horário' : 'horários'})` : `Adicionar ${r.itens.length} à agenda`) : 'Adicionar à agenda'}</button>
    </form>)
}
