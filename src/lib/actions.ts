'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { seedCatalog } from '@/lib/seed'

const CORES = ['#22C55E', '#3B82F6', '#F59E0B', '#EC4899', '#A855F7', '#EF4444', '#14B8A6', '#F97316']

async function ctx() {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  return { sb, uid: user.id }
}
const done = () => { revalidatePath('/disciplinas'); revalidatePath('/conteudos') }

export async function addDiscipline(fd: FormData) {
  const { sb, uid } = await ctx()
  const { count } = await sb.from('disciplines').select('id', { count: 'exact', head: true })
  await sb.from('disciplines').insert({ user_id: uid, nome: String(fd.get('nome')).trim(), peso: Number(fd.get('peso')),
    cor: CORES[(count ?? 0) % CORES.length], ordem: count ?? 0 })
  done()
}
export async function deleteDiscipline(fd: FormData) {
  const { sb } = await ctx()
  await sb.from('disciplines').delete().eq('id', String(fd.get('id')))
  done()
}
export async function addTopic(fd: FormData) {
  const { sb, uid } = await ctx()
  await sb.from('topics').insert({
    user_id: uid, discipline_id: String(fd.get('discipline_id')), nome: String(fd.get('nome')).trim(),
    subcategoria: String(fd.get('subcategoria') || '') || null, prioridade: Number(fd.get('prioridade')),
    dificuldade: Number(fd.get('dificuldade')), planned_date: String(fd.get('planned_date') || '') || null,
    status: fd.get('planned_date') ? 'planejado' : 'nao_iniciado',
  })
  done()
}
export async function updateTopic(fd: FormData) {
  const { sb } = await ctx()
  await sb.from('topics').update({ status: String(fd.get('status')), prioridade: Number(fd.get('prioridade')) }).eq('id', String(fd.get('id')))
  done()
}
export async function deleteTopic(fd: FormData) {
  const { sb } = await ctx()
  await sb.from('topics').delete().eq('id', String(fd.get('id')))
  done()
}
export async function importCatalog() {
  const { sb, uid } = await ctx()
  await seedCatalog(sb, uid)
  done()
}
