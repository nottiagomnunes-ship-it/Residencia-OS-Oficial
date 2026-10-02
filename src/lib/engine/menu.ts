export type ItemMenu = readonly [nome: string, href: string]

/** O menu, em grupos: o que a pessoa faz em cada momento. Início fica sozinho no topo e Configurações no rodapé. */
export const INICIO: ItemMenu = ['Início', '/inicio']
export const GRUPOS: readonly { titulo: string; itens: readonly ItemMenu[] }[] = [
  { titulo: 'Planejar', itens: [['Meu Cronograma', '/cronograma'], ['Minha semana', '/semana'], ['Calendário', '/calendario']] },
  { titulo: 'Estudar', itens: [['Revisões', '/revisoes'], ['Questões', '/questoes'], ['Simulados', '/simulados'], ['Caderno de Erros', '/caderno-de-erros']] },
  { titulo: 'Acompanhar', itens: [['Desempenho', '/desempenho'], ['Metas', '/metas']] },
  { titulo: 'Organizar', itens: [['Disciplinas', '/disciplinas'], ['Conteúdos', '/conteudos']] },
]
export const CONFIGURACOES: ItemMenu = ['Configurações', '/configuracoes']
export const PAGINAS_DO_MENU: readonly ItemMenu[] = [INICIO, ...GRUPOS.flatMap(g => g.itens), CONFIGURACOES]

/** As quatro abas fixas da barra inferior do celular; o resto fica em "Mais". */
export const PRINCIPAIS = ['/inicio', '/calendario', '/revisoes', '/questoes']

/** Páginas que pertencem a um item do menu sem aparecer nele: nelas, o item "pai" fica destacado. */
export const FILHAS: Record<string, string> = { '/importar': '/cronograma' }

export const ativo = (path: string, href: string) =>
  path === href || path.startsWith(href + '/') || Object.entries(FILHAS).some(([filha, pai]) => pai === href && (path === filha || path.startsWith(filha + '/')))
