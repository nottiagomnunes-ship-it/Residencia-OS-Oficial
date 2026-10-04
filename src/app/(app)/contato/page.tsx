import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import { enviarMensagem } from '@/lib/contato'
import { inputCls, fmtData } from '@/components/ui'
import AvisoDaUrl from '@/components/AvisoDaUrl'
import Navegador from '@/components/contato/Navegador'
import PedirProva from '@/components/contato/PedirProva'
import { TIPOS_MENSAGEM, TIPOS_DO_FORMULARIO, type TipoMensagem } from '@/lib/engine/legal'

type Msg = { id: string; tipo: TipoMensagem; texto: string; banca?: string | null; ano?: number | null; pagina: string | null; criada_em: string; resposta: string | null; respondida_em: string | null; resolvida_em: string | null }

/** Ajustes → Sugestões: mandar uma sugestão ou um problema para a administração e ver as respostas. */
export default async function Contato({ searchParams }: { searchParams: Promise<{ tipo?: string; de?: string; ok?: string; erro?: string; pedir?: string; banca?: string; ano?: string }> }) {
  const { tipo, de, ok, erro, pedir, banca, ano } = await searchParams
  const sb = await supabaseServer()
  const { data, error } = await sb.from('mensagens').select('*').order('criada_em', { ascending: false }).limit(30) // '*': funciona antes e depois da 0047 (banca, ano)
  const minhas = (data ?? []) as Msg[]
  const inicial: TipoMensagem = tipo === 'problema' || tipo === 'outro' ? tipo : 'sugestao'
  const pagina = de && /^\/[^\s]{0,299}$/.test(de) ? de : ''
  const pedido = <PedirProva banca={(banca ?? '').slice(0, 80)} ano={/^\d{4}$/.test(ano ?? '') ? ano : ''} />
  return (
    <div className="max-w-3xl space-y-6">
      {ok && <AvisoDaUrl tipo="ok" chaves={['ok']}>{ok}</AvisoDaUrl>}
      {erro && <AvisoDaUrl tipo="erro" chaves={['erro']}>{erro}</AvisoDaUrl>}
      <div className="space-y-1"><h1 className="text-2xl font-semibold">Sugestões e problemas</h1>
        <p className="text-muted">Achou um erro, algo confuso ou tem uma ideia? Escreva aqui: a mensagem vai para a administração do app e a resposta aparece nesta página. Quer uma prova que não está no Banco? <a href="#pedir-prova" className="text-brand underline">Peça aqui</a>.</p></div>
      {pedir === 'prova' && !error && pedido}
      {error && <p className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm text-warn">Esta parte ainda não está ativa (falta atualizar o banco de dados). Tente mais tarde.</p>}

      <form action={enviarMensagem} className="space-y-4 rounded-2xl border border-line bg-surface p-5">
        <fieldset className="flex flex-wrap gap-2"><legend className="mb-2 text-sm">Tipo</legend>
          {TIPOS_DO_FORMULARIO.map(t => (
            <label key={t} className="flex cursor-pointer items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand/10">
              <input type="radio" name="tipo" value={t} defaultChecked={t === inicial} className="accent-brand" />{TIPOS_MENSAGEM[t]}</label>))}
        </fieldset>
        <label className="block space-y-1"><span className="text-sm">Mensagem</span>
          <textarea name="texto" required minLength={3} maxLength={4000} rows={5} className={`${inputCls} w-full`}
            placeholder={inicial === 'problema' ? 'O que você estava fazendo, o que esperava e o que aconteceu.' : 'Escreva aqui.'} /></label>
        <input type="hidden" name="pagina" value={pagina} />
        <Navegador />
        {pagina && <p className="text-xs text-muted">Vai junto o endereço da página onde o problema aconteceu ({pagina}).</p>}
        <p className="text-xs text-muted">Junto com a mensagem vão a sua conta e o tipo de navegador, para a gente conseguir responder e reproduzir o problema. Não escreva dados de pacientes.</p>
        <button className="rounded-xl bg-brand px-4 py-2 font-medium text-black">Enviar</button>
      </form>

      {pedir !== 'prova' && !error && pedido}

      {minhas.length > 0 && <section className="space-y-3">
        <h2 className="font-medium">Suas mensagens</h2>
        <ul className="space-y-3">{minhas.map(m => (
          <li key={m.id} className="space-y-2 rounded-2xl border border-line bg-surface p-4 text-sm">
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="rounded-full border border-line px-2 py-0.5">{TIPOS_MENSAGEM[m.tipo] ?? m.tipo}{m.tipo === 'prova' && m.banca ? `: ${m.banca}${m.ano ? ` ${m.ano}` : ''}` : ''}</span>
              <span>{fmtData(m.criada_em.slice(0, 10))}</span>
              <span className={m.resolvida_em ? 'text-brand' : ''}>{m.resolvida_em ? 'Resolvida' : m.resposta ? 'Respondida' : 'Aguardando'}</span>
            </p>
            <p className="whitespace-pre-wrap">{m.texto}</p>
            {m.resposta && <div className="rounded-xl border border-brand/40 bg-brand/10 p-3"><p className="text-xs text-muted">Resposta{m.respondida_em ? ` · ${fmtData(m.respondida_em.slice(0, 10))}` : ''}</p>
              <p className="whitespace-pre-wrap">{m.resposta}</p></div>}
          </li>))}</ul>
      </section>}

      <p className="text-sm text-muted">Leia também os <Link href="/termos" className="text-brand underline">Termos de uso</Link> e a <Link href="/privacidade" className="text-brand underline">Política de privacidade</Link>. Para pedir a exclusão da sua conta, envie uma mensagem do tipo &quot;Outro assunto&quot;.</p>
    </div>)
}
