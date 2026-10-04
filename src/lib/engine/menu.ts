export type Aba = readonly [nome: string, href: string]
export type Icone = 'hoje' | 'agenda' | 'questoes' | 'materias' | 'progresso' | 'ajustes' | 'admin' | 'mensagem'

/**
 * O app em 5 seções. Cada seção abre na primeira aba; as outras páginas dela aparecem como abas no topo da página (SubNav).
 * `filhas`: páginas que não são abas, mas moram dentro de uma (ex.: /importar fica dentro de "Plano de estudo").
 */
export type Secao = { nome: string; href: string; icone: Icone; abas: readonly Aba[]; filhas?: Readonly<Record<string, string>> }
export const SECOES: readonly Secao[] = [
  { nome: 'Hoje', href: '/inicio', icone: 'hoje', abas: [['Hoje', '/inicio'], ['Revisões', '/revisoes']] },
  { nome: 'Agenda', href: '/calendario', icone: 'agenda', abas: [['Calendário', '/calendario'], ['Plano', '/cronograma'], ['Meu tempo', '/semana'], ['Compromissos', '/agenda']],
    filhas: { '/importar': '/cronograma' } },
  { nome: 'Questões', href: '/banco', icone: 'questoes', abas: [['Praticar', '/banco'], ['Banco', '/banco/questoes'], ['Provas', '/provas'], ['Registrar', '/questoes'], ['Erros', '/caderno-de-erros']] },
  { nome: 'Matérias', href: '/disciplinas', icone: 'materias', abas: [['Disciplinas', '/disciplinas'], ['Assuntos', '/conteudos']] },
  { nome: 'Progresso', href: '/desempenho', icone: 'progresso', abas: [['Desempenho', '/desempenho'], ['Metas', '/metas'], ['Simulados', '/simulados']] },
]
/** Fora das 5 seções: no rodapé do menu (computador) e na engrenagem do topo (celular). */
export const AJUSTES: Secao = { nome: 'Ajustes', href: '/configuracoes', icone: 'ajustes', abas: [['Configurações', '/configuracoes'], ['Ajuda', '/ajuda'], ['Sugestões', '/contato']], filhas: { '/diagnostico': '/configuracoes' } }

/** Só para a conta administradora: cuidar do banco geral (questões, temas, explicações). Fica no rodapé do menu e no topo, no celular. */
export const ADMIN: Secao = { nome: 'Administração', href: '/admin', icone: 'admin',
  abas: [['Pendências', '/admin'], ['Questões', '/admin/questoes'], ['Importar', '/admin/importar'], ['Temas', '/admin/temas'], ['Mensagens', '/admin/mensagens']] }

/** A página `path` é a página `href` ou mora dentro dela (/provas/tentativa/x está dentro de /provas). */
export const dentro = (path: string, href: string) => path === href || path.startsWith(href + '/')

/**
 * A aba (href) em que a página está, dentro da seção: o endereço mais específico que casa, seja de uma aba ou de uma página filha
 * (/admin/questoes/x fica em "Questões", mesmo estando dentro de /admin, que é "Pendências").
 */
export function abaDe(path: string, s: Secao): string | null {
  const casos: [string, string][] = [...s.abas.map(([, h]): [string, string] => [h, h]), ...Object.entries(s.filhas ?? {})]
  const melhor = casos.filter(([k]) => dentro(path, k)).sort((a, b) => b[0].length - a[0].length)[0]
  return melhor ? melhor[1] : null
}
/** A seção da página (ou Ajustes; null se a página não pertence a nenhuma). */
export const secaoDe = (path: string): Secao | null => [...SECOES, AJUSTES, ADMIN].find(s => abaDe(path, s) !== null) ?? null

/** Todas as páginas alcançáveis pelo menu (para conferir nos testes). */
export const TODAS_AS_ABAS: readonly Aba[] = [...SECOES.flatMap(s => s.abas), ...AJUSTES.abas]
