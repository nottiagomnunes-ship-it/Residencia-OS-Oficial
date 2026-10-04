import type { Metadata } from 'next'
import Link from 'next/link'
import PaginaLegal from '@/components/PaginaLegal'
import { responsavel } from '@/lib/engine/legal'

export const metadata: Metadata = { title: 'Termos de uso · Residência OS' }

export default function Termos() {
  const r = responsavel()
  return (
    <PaginaLegal titulo="Termos de uso">
      <p>O Residência OS é um app de organização de estudos para provas de residência médica, mantido por {r.nome}. Ao criar uma conta, você concorda com estes termos.</p>

      <h2>1. O que o app é (e o que não é)</h2>
      <ul>
        <li>Uma ferramenta de estudo: plano, revisões, banco de questões, provas, caderno de erros e desempenho.</li>
        <li>Não é orientação médica nem substitui livros, diretrizes ou professores. Não use o conteúdo do app para decidir condutas com pacientes.</li>
        <li>O app está em fase de testes: funções podem mudar, falhar ou sair do ar sem aviso. Guarde um backup quando quiser (Configurações → Meus dados).</li>
      </ul>

      <h2>2. Questões e explicações</h2>
      <ul>
        <li>As questões do banco vêm de provas de residência já aplicadas e são usadas para fins de estudo. A banca e o ano aparecem em cada questão, quando conhecidos.</li>
        <li>Parte das explicações e alguns gabaritos são escritos com ajuda de inteligência artificial e revisados aos poucos. Podem conter erros: na dúvida, confira na fonte. Use &quot;Reportar erro&quot; na explicação para avisar de um erro.</li>
        <li>Se você é titular de um conteúdo publicado no app e quer que ele seja retirado, escreva para a administração (abaixo) que o pedido é atendido.</li>
      </ul>

      <h2>3. Sua conta</h2>
      <ul>
        <li>A conta é pessoal. Você é responsável pela sua senha e pelo que é feito com ela.</li>
        <li>O que você cria (plano, anotações, questões que você mesmo importa) é seu. Você pode baixar tudo e apagar tudo quando quiser, em Configurações.</li>
        <li>Não envie ao app dados de pacientes nem conteúdo que você não tem direito de usar.</li>
        <li>Contas usadas para abuso (por exemplo, sobrecarregar o serviço ou tentar acessar dados de outras pessoas) podem ser suspensas.</li>
      </ul>

      <h2>4. Responsabilidade</h2>
      <p>O app é oferecido como está, sem garantia de resultado em provas nem de funcionamento contínuo. Fazemos o possível para não perder dados, mas recomendamos guardar backups.</p>

      <h2>5. Mudanças nestes termos</h2>
      <p>Se os termos mudarem, a data no topo muda junto. Mudanças importantes serão avisadas no app.</p>

      <h2>6. Contato</h2>
      <p>Pelo app, em <Link href="/contato" className="text-brand underline">Ajustes → Sugestões</Link>{r.email ? <>, ou pelo e-mail <a href={`mailto:${r.email}`} className="text-brand underline">{r.email}</a></> : null}. Como os dados são tratados está na <Link href="/privacidade" className="text-brand underline">Política de privacidade</Link>.</p>
    </PaginaLegal>)
}
