'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { ehAdmin } from '@/lib/banco-data'

const SEM_TABELA = 'Falta atualizar o banco: rode supabase/migrations/0050_provas_do_banco.sql no SQL Editor do Supabase.'
const aviso = (base: string, tipo: 'ok' | 'erro', msg: string) => `${base}${base.includes('?') ? '&' : '?'}${tipo}=${encodeURIComponent(msg)}`
const uuid = (v: unknown) => (typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v) ? v : null)
const semTabela = (m: string) => /provas_geral|prova_geral_questoes|cadastrar_prova/.test(m) && /exist|schema cache|function/.test(m)

async function admin() {
  const sb = await supabaseServer()
  if (!(await ehAdmin(sb))) redirect('/banco')
  return sb
}
function cadastro(fd: FormData) {
  const nome = String(fd.get('nome') ?? '').replace(/\s+/g, ' ').trim().slice(0, 120), banca = String(fd.get('banca') ?? '').trim().slice(0, 60)
  const ano = Number(fd.get('ano')), total = Number(fd.get('total'))
  if (nome.length < 2) return 'Dê um nome à prova (ex.: "USP-SP 2025 – Acesso direto").'
  if (!banca) return 'Diga a banca da prova.'
  if (!Number.isInteger(ano) || ano < 1990 || ano > 2100) return 'Confira o ano da prova.'
  if (!Number.isInteger(total) || total < 1 || total > 300) return 'Diga quantas questões a prova tem (1 a 300).'
  return { nome, banca, ano, total }
}
const pronto = () => { revalidatePath('/admin', 'layout'); revalidatePath('/provas') }

/** Cadastrar uma prova com as questões que já estão publicadas (banca + ano, e a coleção, se escolhida), pelo número de cada uma. */
export async function cadastrarProvaExistente(fd: FormData) {
  const sb = await admin()
  const c = cadastro(fd)
  if (typeof c === 'string') redirect(aviso('/admin/provas', 'erro', c))
  const colecao = String(fd.get('colecao') ?? '').trim() || null
  const { data, error } = await sb.rpc('cadastrar_prova_existente', { p_nome: c.nome, p_banca: c.banca, p_ano: c.ano, p_total: c.total, p_colecao: colecao })
  if (error) redirect(aviso('/admin/provas', 'erro', semTabela(error.message) ? SEM_TABELA : /duplicate|unique/.test(error.message) ? 'Já existe uma prova com esse nome, banca e ano.' : 'Não foi possível cadastrar a prova.'))
  const r = data as { id: string; ligadas: number }
  pronto()
  redirect(aviso(`/admin/provas/${r.id}`, 'ok', `Prova cadastrada com ${r.ligadas} de ${c.total} questões.`))
}

/** Mudar nome, banca, ano ou total de uma prova. */
export async function salvarProvaGeral(fd: FormData) {
  const sb = await admin()
  const id = uuid(fd.get('id'))
  if (!id) redirect('/admin/provas')
  const volta = `/admin/provas/${id}`
  const c = cadastro(fd)
  if (typeof c === 'string') redirect(aviso(volta, 'erro', c))
  const { error } = await sb.from('provas_geral').update({ ...c, atualizada_em: new Date().toISOString() }).eq('id', id)
  if (error) redirect(aviso(volta, 'erro', /duplicate|unique/.test(error.message) ? 'Já existe uma prova com esse nome, banca e ano.' : 'Não foi possível salvar.'))
  pronto()
  redirect(aviso(volta, 'ok', 'Prova salva.'))
}

/** Tirar uma questão da prova (ela continua no banco, só deixa de fazer parte desta prova). */
export async function tirarDaProva(fd: FormData) {
  const sb = await admin()
  const id = uuid(fd.get('prova')), numero = Number(fd.get('numero'))
  if (!id || !Number.isInteger(numero)) redirect('/admin/provas')
  const { error } = await sb.from('prova_geral_questoes').delete().eq('prova_id', id).eq('numero', numero)
  pronto()
  redirect(aviso(`/admin/provas/${id}`, error ? 'erro' : 'ok', error ? 'Não foi possível tirar a questão.' : `Questão ${numero} tirada da prova (continua no banco).`))
}

/** Apagar o cadastro da prova. As questões continuam no banco; as provas que as contas já fizeram continuam em "Suas provas". */
export async function excluirProvaGeral(fd: FormData) {
  const sb = await admin()
  const id = uuid(fd.get('id'))
  if (!id) redirect('/admin/provas')
  const { error } = await sb.from('provas_geral').delete().eq('id', id)
  pronto()
  redirect(aviso('/admin/provas', error ? 'erro' : 'ok', error ? 'Não foi possível apagar a prova.' : 'Prova apagada. As questões continuam no banco.'))
}
