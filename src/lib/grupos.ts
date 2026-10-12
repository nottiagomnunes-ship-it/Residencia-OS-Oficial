'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { supabaseServer } from '@/lib/supabase/server'
import { apelidoValido, codigoValido, nomeDoGrupo } from '@/lib/engine/grupos'

const semFuncao = (e: { code?: string; message?: string } | null) => !!e && (e.code === 'PGRST202' || e.code === '42883' || /does not exist|Could not find the function/i.test(e.message ?? ''))
const voltar = (q: Record<string, string>): never => redirect('/grupos?' + new URLSearchParams(q).toString())

async function ctx() {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  return sb
}

export async function criarGrupo(fd: FormData) {
  const sb = await ctx(), nome = nomeDoGrupo(fd.get('nome')), apelido = apelidoValido(fd.get('apelido'))
  if (!nome) voltar({ erro: 'nome' })
  if (!apelido) voltar({ erro: 'apelido' })
  const { data, error } = await sb.rpc('criar_grupo', { p_nome: nome, p_apelido: apelido })
  if (error) voltar({ erro: semFuncao(error) ? 'desligado' : 'falha' })
  if (data?.erro) voltar({ erro: data.erro })
  revalidatePath('/grupos')
  voltar({ g: data.id, msg: `Grupo criado. Mande o código ${data.codigo} (ou o convite) para quem você quiser.` })
}

export async function entrarNoGrupo(fd: FormData) {
  const sb = await ctx(), codigo = codigoValido(fd.get('codigo')), apelido = apelidoValido(fd.get('apelido'))
  if (!codigo) voltar({ erro: 'codigo' })
  if (!apelido) voltar({ erro: 'apelido', codigo: String(codigo) })
  const { data, error } = await sb.rpc('entrar_no_grupo', { p_codigo: codigo, p_apelido: apelido })
  if (error) voltar({ erro: semFuncao(error) ? 'desligado' : 'falha' })
  if (data?.erro) voltar({ erro: data.erro, codigo: String(codigo) })
  ;(await cookies()).delete('convite')
  revalidatePath('/grupos')
  voltar({ g: data.id, msg: data.ja ? 'Você já estava nesse grupo.' : 'Você entrou no grupo.' })
}

export async function sairDoGrupo(fd: FormData) {
  const sb = await ctx(), id = String(fd.get('grupo') ?? '')
  const { error } = await sb.rpc('sair_do_grupo', { p_grupo: id })
  if (error) voltar({ erro: 'falha', g: id })
  revalidatePath('/grupos')
  voltar({ msg: 'Você saiu do grupo.' })
}

export async function mudarApelido(fd: FormData) {
  const sb = await ctx(), id = String(fd.get('grupo') ?? ''), apelido = apelidoValido(fd.get('apelido'))
  if (!apelido) voltar({ erro: 'apelido', g: id })
  const { data: { user } } = await sb.auth.getUser()
  const { error } = await sb.from('grupo_membros').update({ apelido }).eq('grupo_id', id).eq('user_id', user!.id)
  if (error) voltar({ erro: 'falha', g: id })
  revalidatePath('/grupos')
  voltar({ g: id, msg: 'Apelido atualizado.' })
}

/** "Agora não" no aviso de convite em Hoje. */
export async function esquecerConvite() {
  ;(await cookies()).delete('convite')
  revalidatePath('/inicio')
}
