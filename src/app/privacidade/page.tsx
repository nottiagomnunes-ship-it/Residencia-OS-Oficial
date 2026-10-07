import type { Metadata } from 'next'
import Link from 'next/link'
import PaginaLegal from '@/components/PaginaLegal'
import { responsavel } from '@/lib/engine/legal'

export const metadata: Metadata = { title: 'Política de privacidade · R1TMO' }

export default function Privacidade() {
  const r = responsavel()
  return (
    <PaginaLegal titulo="Política de privacidade">
      <p>Esta política explica quais dados o R1TMO guarda, para quê e como você controla isso, nos termos da Lei Geral de Proteção de Dados (Lei 13.709/2018). O controlador dos dados é {r.nome}.</p>

      <h2>1. Dados que guardamos</h2>
      <ul>
        <li><b>Conta:</b> e-mail e senha (a senha é guardada cifrada pelo serviço de autenticação; ninguém consegue lê-la).</li>
        <li><b>Se você entrar com o Google:</b> o Google nos informa o seu e-mail (já confirmado), nome e foto do perfil, que ficam guardados junto ao login. O app usa só o e-mail; nome e foto não aparecem no app nem são usados para nada. Não recebemos a sua senha do Google nem acesso a Gmail, Drive ou contatos.</li>
        <li><b>Seu estudo:</b> o que você cria e registra no app — data da prova, tempo de estudo por dia, disciplinas, assuntos, cronograma, revisões, compromissos, respostas a questões e provas, caderno de erros, simulados, metas, XP e configurações.</li>
        <li><b>Arquivos que você envia:</b> PDFs e documentos importados, as figuras das questões e o PDF de um pedido de prova (apagado quando o pedido é atendido).</li>
        <li><b>Mensagens:</b> o que você envia em Sugestões (inclusive pedidos de prova), com a página de onde veio e o tipo de navegador.</li>
        <li><b>Uso do site (anônimo):</b> quais páginas são abertas, quantas visitas houve, de que site a pessoa chegou, de que país (aproximado), tipo de aparelho, navegador e sistema, e o tempo de carregamento das páginas. É contado sem cookies e sem e-mail, nome ou identificador da sua conta; o endereço da página vai sem filtros nem códigos e com os números de itens trocados por &quot;[id]&quot;. Não dá para saber, por esses números, quem usou o quê.</li>
        <li><b>Erros do site:</b> quando uma tela falha, o app registra a mensagem do erro, a página, o navegador e a conta, para a falha poder ser corrigida.</li>
      </ul>
      <p>Não pedimos nome (só o que o Google informa, se você entrar por ele), CPF, telefone nem dados de saúde, e você não deve enviar dados de pacientes.</p>

      <h2>2. Para que usamos</h2>
      <ul>
        <li>Fazer o app funcionar para você: montar o plano, as revisões e o desempenho (execução do serviço que você pediu ao criar a conta).</li>
        <li>Enviar o lembrete diário por e-mail, só se você ligar essa opção em Configurações.</li>
        <li>Responder às suas mensagens e corrigir erros do app.</li>
        <li>Entender, de forma agregada e anônima, quais partes do app são mais usadas e quais páginas estão lentas, para decidir o que melhorar (interesse legítimo em manter e melhorar o serviço).</li>
      </ul>
      <p>Não vendemos dados, não mostramos anúncios, não montamos perfil de ninguém e não usamos rastreamento para publicidade. A análise de uso acima serve só para melhorar o app.</p>

      <h2>3. Quem mais participa</h2>
      <p>Para funcionar, o app usa estes serviços, que tratam os dados em nosso nome e podem guardá-los fora do Brasil:</p>
      <ul>
        <li><b>Supabase:</b> banco de dados, login e armazenamento de arquivos.</li>
        <li><b>Google:</b> só se você escolher &quot;Continuar com o Google&quot;, para confirmar quem você é. O uso da sua conta Google segue também a política de privacidade do Google.</li>
        <li><b>Vercel:</b> hospedagem do site e análise de uso anônima (Vercel Web Analytics e Speed Insights).</li>
        <li><b>Resend:</b> envio do lembrete por e-mail (só o seu e-mail e o conteúdo do lembrete).</li>
      </ul>
      <p>A administração do app consegue ver as mensagens que você envia e os erros registrados. Seus dados de estudo são protegidos por regras de acesso por conta: as outras pessoas que usam o app não os veem.</p>

      <h2>4. Cookies e armazenamento no aparelho</h2>
      <p>Usamos só o necessário: cookies de sessão (para manter você conectado) e de preferências deste aparelho (menu recolhido, tamanho do texto), e o armazenamento local do navegador para não perder uma prova em andamento. Nada disso é usado para publicidade. A análise de uso não grava cookies nem nada no seu aparelho.</p>

      <h2>5. Por quanto tempo</h2>
      <p>Enquanto a conta existir. Ao usar &quot;Apagar tudo&quot;, os dados de estudo são apagados na hora. Ao pedir a exclusão da conta, apagamos também o e-mail e o login (inclusive o nome e a foto vindos do Google). Para tirar do Google o acesso do R1TMO, use a página &quot;Apps e serviços de terceiros&quot; da sua conta Google. Os registros de erro são apagados periodicamente. Os dados anônimos de uso ficam no painel da Vercel pelo prazo do plano contratado e depois são descartados por ela.</p>

      <h2>6. Seus direitos</h2>
      <ul>
        <li><b>Ver e levar seus dados:</b> Configurações → Meus dados (backup completo em JSON e planilhas CSV).</li>
        <li><b>Corrigir:</b> direto nas páginas do app.</li>
        <li><b>Apagar:</b> Configurações → &quot;Apagar tudo e começar do zero&quot;. Para excluir a conta inteira (inclusive o e-mail), peça em <Link href="/contato" className="text-brand underline">Ajustes → Sugestões</Link>.</li>
        <li><b>Saber mais ou se opor a algum uso:</b> pelo mesmo canal. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).</li>
      </ul>

      <h2>7. Segurança</h2>
      <p>A conexão é cifrada (HTTPS), o acesso aos dados é separado por conta e só a administração tem acesso às ferramentas de manutenção. Nenhum sistema é 100% seguro: se houver um incidente que afete seus dados, você será avisado.</p>

      <h2>8. Contato</h2>
      <p>Pelo app, em <Link href="/contato" className="text-brand underline">Ajustes → Sugestões</Link>{r.email ? <>, ou pelo e-mail <a href={`mailto:${r.email}`} className="text-brand underline">{r.email}</a></> : null}.</p>
    </PaginaLegal>)
}
