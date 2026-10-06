/** Logo do R1TMO: "R1" grifado em verde, como num resumo marcado com caneta, e "TMO" na cor do texto,
 *  na fonte do logo (Bricolage Grotesque). O grifo é o mesmo verde nos dois temas, como no ícone do app.
 *  `tamanho` escolhe a escala (menu, tela de entrada). */
export default function Marca({ tamanho = 'md' }: { tamanho?: 'sm' | 'md' | 'lg' }) {
  const txt = { sm: 'text-lg', md: 'text-2xl', lg: 'text-5xl' }[tamanho]
  return (
    <span className={`inline-flex items-baseline font-logo font-extrabold leading-none tracking-[-0.03em] text-ink ${txt}`} aria-label="R1TMO" role="img">
      <span aria-hidden className="inline-block -rotate-2 rounded-[0.12em_0.05em_0.15em_0.05em] bg-grifo px-[0.1em] py-[0.04em] text-on-grifo">R1</span>
      <span aria-hidden className="pl-[0.06em]">TMO</span>
    </span>)
}
