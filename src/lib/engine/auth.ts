/** Traduz as mensagens do Supabase Auth para português, sem expor detalhes técnicos. */
export function mensagemAuth(msg: string) {
  const m = msg.toLowerCase()
  if (m.includes('invalid login')) return 'E-mail ou senha incorretos.'
  if (m.includes('already registered') || m.includes('already been registered')) return 'Este e-mail já tem conta. Use "Entrar".'
  if (m.includes('email not confirmed')) return 'Confirme o seu e-mail pelo link que enviamos antes de entrar.'
  if ((m.includes('at least') && m.includes('character')) || m.includes('weak')) return 'A senha é curta ou fraca demais. Use pelo menos 8 caracteres.'
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
