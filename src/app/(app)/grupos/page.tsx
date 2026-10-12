import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import { hojeBR } from '@/lib/dates'
import { criarGrupo, entrarNoGrupo, mudarApelido } from '@/lib/grupos'
import { ERROS_GRUPO, apelidoSugerido, codigoValido, ordenarRanking, semanaDe, textoConvite, type LinhaRanking } from '@/lib/engine/grupos'
import { Bar, fmtData, inputCls } from '@/components/ui'
import { Convidar, Sair } from '@/components/GrupoAcoes'

type Sp = Promise<{ g?: string; msg?: string; erro?: string; codigo?: string }>
type Meu = { grupo_id: string; apelido: string; grupos: { id: string; nome: string; codigo: string } | null }

export default async function Grupos({ searchParams }: { searchParams: Sp }) {
  const { g, msg, erro, codigo } = await searchParams
  const sb = await supabaseServer(), hoje = hojeBR(), sem = semanaDe(hoje)
  const { data: { user } } = await sb.auth.getUser()
  const [{ data: perfil }, { data: meus, error }] = await Promise.all([
    sb.from('profiles').select('nome').single(),
    sb.from('grupo_membros').select('grupo_id,apelido,grupos(id,nome,codigo)').eq('user_id', user?.id ?? '').order('entrou_em'),
  ])
  const desligado = !!error // sem a migração 0052
  const lista = ((meus ?? []) as unknown as Meu[]).filter(m => m.grupos)
  const atual = lista.find(m => m.grupo_id === g) ?? lista[0]
  let ranking = null as ReturnType<typeof ordenarRanking> | null
  if (atual) {
    const { data } = await sb.rpc('ranking_do_grupo', { p_grupo: atual.grupo_id, p_ini: sem.ini, p_hoje: hoje })
    ranking = ordenarRanking((data ?? []) as LinhaRanking[])
  }
  const sugestao = apelidoSugerido(perfil?.nome), cod = codigoValido(codigo) ?? ''
  const entrar = (
    <form action={entrarNoGrupo} className="space-y-3 rounded-2xl border border-line bg-surface p-5">
      <h2 className="font-medium">Entrar com um código</h2>
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm"><span className="block">Código</span><input name="codigo" defaultValue={cod} required maxLength={8} autoCapitalize="characters" placeholder="Ex.: K7Q2MD" className={inputCls + ' w-32 uppercase tracking-widest'} /></label>
        <label className="space-y-1 text-sm"><span className="block">Como você aparece</span><input name="apelido" defaultValue={sugestao} required maxLength={30} className={inputCls + ' w-40'} /></label>
        <button className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-on-cor">Entrar</button>
      </div>
    </form>)
  const criar = (
    <form action={criarGrupo} className="space-y-3 rounded-2xl border border-line bg-surface p-5">
      <h2 className="font-medium">Criar um grupo</h2>
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm"><span className="block">Nome do grupo</span><input name="nome" required maxLength={40} placeholder="Ex.: Turma do internato" className={inputCls + ' w-56'} /></label>
        <label className="space-y-1 text-sm"><span className="block">Como você aparece</span><input name="apelido" defaultValue={sugestao} required maxLength={30} className={inputCls + ' w-40'} /></label>
        <button className="rounded-xl border border-brand px-4 py-2 text-sm text-brand">Criar</button>
      </div>
    </form>)
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Grupos</h1>
        <p className="text-sm text-muted">Um ranking da semana só com quem você convidar. Opcional: ninguém vê nada seu se você não estiver num grupo.</p>
      </div>
      {msg && <p role="status" className="rounded-xl border border-line bg-surface p-4 text-sm">{msg}</p>}
      {erro && <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm">{ERROS_GRUPO[erro] ?? ERROS_GRUPO.falha}</p>}
      {desligado ? <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">{ERROS_GRUPO.desligado}</p> : (
        <>
          {lista.length > 1 && (
            <nav aria-label="Seus grupos" className="flex flex-wrap gap-2">
              {lista.map(m => <Link key={m.grupo_id} href={`/grupos?g=${m.grupo_id}`} aria-current={m === atual ? 'page' : undefined}
                className={`rounded-xl border px-3 py-1.5 text-sm ${m === atual ? 'border-brand bg-brand/10 text-brand' : 'border-line'}`}>{m.grupos!.nome}</Link>)}
            </nav>)}
          {atual && ranking && (
            <section className="space-y-4 rounded-2xl border border-line bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{atual.grupos!.nome}</h2>
                  <p className="text-sm text-muted">Semana de {fmtData(sem.ini)} a {fmtData(sem.fim)} · reinicia toda segunda · código <span className="font-mono tracking-widest">{atual.grupos!.codigo}</span></p>
                </div>
                <Convidar texto={textoConvite(atual.grupos!.nome, atual.grupos!.codigo)} />
              </div>
              <ol className="divide-y divide-line">
                {ranking.map((l, k) => (
                  <li key={k} className={`flex items-center gap-3 py-3 ${l.eu ? 'font-medium' : ''}`}>
                    <span className="w-6 text-center text-muted">{l.posicao ?? '–'}</span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-baseline justify-between gap-2"><span className="truncate">{l.apelido}{l.eu && <span className="text-brand"> (você)</span>}</span>
                        <span className={l.pct === null ? 'text-sm text-muted' : ''}>{l.pct === null ? 'sem plano na semana' : `${l.pct}% do plano`}</span></div>
                      {l.pct !== null && <Bar pct={l.pct} />}
                      <p className="text-xs text-muted">{l.questoes} {l.questoes === 1 ? 'questão' : 'questões'} · {l.dias} {l.dias === 1 ? 'dia' : 'dias'} com estudo</p>
                    </div>
                  </li>))}
              </ol>
              <p className="text-xs text-muted">% do plano = minutos das tarefas concluídas ÷ minutos das tarefas da semana até hoje (as de hoje só contam depois de feitas). Cada um é comparado com o próprio plano, não com as horas dos outros. Ninguém vê seus assuntos, questões ou horários: só o apelido e estes números.</p>
              <div className="flex flex-wrap items-end justify-between gap-3 border-t border-line pt-4">
                <form action={mudarApelido} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="grupo" value={atual.grupo_id} />
                  <label className="space-y-1 text-sm"><span className="block">Seu apelido neste grupo</span><input name="apelido" defaultValue={atual.apelido} required maxLength={30} className={inputCls + ' w-40'} /></label>
                  <button className="rounded-xl border border-line px-3 py-2 text-sm">Salvar</button>
                </form>
                <Sair grupo={atual.grupo_id} ultimo={ranking.length === 1} />
              </div>
            </section>)}
          {!lista.length && <p className="rounded-2xl border border-dashed border-line p-6 text-center text-muted">Você ainda não está em nenhum grupo. Crie um e mande o convite para a turma, ou entre com o código que recebeu.</p>}
          <div className="grid gap-4 md:grid-cols-2">{cod ? <>{entrar}{criar}</> : <>{criar}{entrar}</>}</div>
        </>)}
    </div>)
}
