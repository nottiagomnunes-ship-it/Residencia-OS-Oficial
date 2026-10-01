import { createClient } from '@supabase/supabase-js'

/** Cliente administrativo (ignora a RLS). Só para tarefas agendadas no servidor; nunca importar em código que roda no navegador. */
export function supabaseAdmin() {
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!chave) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chave, { auth: { persistSession: false, autoRefreshToken: false } })
}
