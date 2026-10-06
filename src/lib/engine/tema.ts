/** Tema de cores do app neste aparelho (Configurações → Aparência). "sistema" segue o claro/escuro do celular ou computador. */
export const TEMAS = ['escuro', 'claro', 'sistema'] as const
export type Tema = (typeof TEMAS)[number]
export const ROTULOS_TEMA: Record<Tema, string> = { escuro: 'Escuro', claro: 'Claro', sistema: 'Igual ao aparelho' }
/** O cookie "tema" vem do navegador: qualquer outro valor vale "escuro" (o visual de sempre do app). */
export const lerTema = (valor: string | null | undefined): Tema => ((TEMAS as readonly string[]).includes(valor ?? '') ? (valor as Tema) : 'escuro')
/** Cor da barra do navegador/celular em cada tema (o fundo do app). */
export const COR_DA_BARRA = { escuro: '#0A0F0D', claro: '#F6F8F7' } as const
