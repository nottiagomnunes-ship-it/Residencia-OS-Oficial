/** Traduz as mensagens do Supabase Auth para português, sem expor detalhes técnicos. */
export function mensagemAuth(msg: string) {
  const m = msg.toLowerCase()
  if (m.includes('invalid login')) return 'E-mail ou senha incorretos.'
  if (m.includes('already registered') || m.includes('already been registered')) return 'Este e-mail já tem conta. Use "Entrar".'
  if (m.includes('email not confirmed')) return 'Confirme o seu e-mail pelo link que enviamos antes de entrar.'
  if ((m.includes('at least') && m.includes('character')) || m.includes('weak')) return 'A senha é curta ou fraca demais. Use pelo menos 8 caracteres.'
  if (m.includes('same password') || m.includes('different from the old')) return 'Escolha uma senha diferente da atual.'
  if (m.includes('session missing') || m.includes('expired') || m.includes('invalid token')) return 'O link expirou ou já foi usado. Peça um novo em "Esqueci minha senha".'
  if (m.includes('rate limit') || m.includes('too many')) return 'Muitas tentativas. Espere alguns minutos e tente de novo.'
  if (m.includes('valid email') || m.includes('invalid email')) return 'Informe um e-mail válido.'
  return 'Não foi possível concluir. Tente de novo em instantes.'
}
/** Valida o formulário de cadastro; devolve a mensagem de erro ou null. */
export function validarCadastro(email: string, senha: string, confirmar: string): string | null {
  if (!/^\S+@\S+\.\S+$/.test(email)) return 'Informe um e-mail válido.'
  if (senha.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.'
  if (senha !== confirmar) return 'As senhas não são iguais.'
  return null
}

/** Valida a nova senha (redefinição): tamanho e confirmação. */
export function validarSenhaNova(senha: string, confirmar: string): string | null {
  if (senha.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.'
  if (senha !== confirmar) return 'As senhas não são iguais.'
  return null
}
/** Só aceita caminhos internos (/algo): evita que um link malicioso redirecione para outro site. */
export function caminhoSeguro(next: string | null, padrao = '/inicio') {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\') || /[\u0000-\u001f]/.test(next)) return padrao
  return next
}

/** Entrar com o Google fica escondido até a variável LOGIN_GOOGLE=ligado existir (depois de configurar o Google no Supabase). */
export function googleLigado(valor: string | undefined) {
  return ['ligado', '1', 'true', 'sim'].includes(String(valor ?? '').trim().toLowerCase())
}

/**
 * Navegador embutido de outro app (Instagram, Facebook, TikTok, LinkedIn, Line, WebView do Android…)?
 * O Google bloqueia o login nesses navegadores ("disallowed_useragent"), então o app pede para abrir no Chrome ou Safari.
 */
export function navegadorEmbutido(ua: string | null | undefined) {
  if (!ua) return false
  return /FBAN|FBAV|FB_IAB|Instagram|Line\/|musical_ly|BytedanceWebview|TikTok|LinkedInApp|Snapchat|Pinterest|; wv\)/i.test(ua)
}

/** Mensagem quando a volta do Google não deu certo (cancelou na tela do Google ou outro erro). */
export function mensagemGoogle(erro: string | null | undefined) {
  if (erro === 'access_denied') return 'Entrada com o Google cancelada.'
  return 'Não foi possível entrar com o Google. Tente de novo ou use e-mail e senha.'
}
