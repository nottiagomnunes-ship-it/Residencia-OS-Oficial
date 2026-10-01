import { createBrowserClient } from '@supabase/ssr'

/** Cliente do navegador (grava a sessão em cookies, que o servidor também enxerga). */
export const supabaseBrowser = () => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
