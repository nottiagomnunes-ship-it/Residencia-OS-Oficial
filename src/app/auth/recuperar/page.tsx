'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'

/**
 * Destino do link do e-mail de recuperação (modelo padrão do Supabase). O link traz a sessão no "#" do endereço,
 * que só o navegador enxerga: aqui ela é gravada e a pessoa segue para criar a nova senha. Funciona em qualquer aparelho.
 */
export default function Recuperar() {
  const router = useRouter()
  useEffect(() => {
    const h = new URLSearchParams(window.location.hash.slice(1)), q = new URLSearchParams(window.location.search)
    if (q.get('code')) { window.location.replace(`/auth/confirm?code=${encodeURIComponent(q.get('code')!)}&next=/redefinir-senha`); return } // link no formato antigo (PKCE)
    const access_token = h.get('access_token'), refresh_token = h.get('refresh_token')
    if (h.get('error') || !access_token || !refresh_token) { router.replace('/recuperar-senha?erro=link'); return }
    supabaseBrowser().auth.setSession({ access_token, refresh_token }).then(({ error }) => {
      if (error) { router.replace('/recuperar-senha?erro=link'); return }
      window.history.replaceState(null, '', '/auth/recuperar') // tira as chaves do endereço
      router.replace(h.get('type') === 'recovery' ? '/redefinir-senha' : '/inicio')
    })
  }, [router])
  return <main className="grid min-h-dvh place-items-center p-6"><p role="status" className="text-muted">Validando o link…</p></main>
}
