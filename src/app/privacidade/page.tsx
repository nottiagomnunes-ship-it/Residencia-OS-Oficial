import type { Metadata } from 'next'
import Link from 'next/link'
import PaginaLegal from '@/components/PaginaLegal'
import { responsavel } from '@/lib/engine/legal'

export const metadata: Metadata = { title: 'Política de privacidade · Residência OS' }

export default function Privacidade() {
  const r = responsavel()
  return (
    <PaginaLegal titulo="Política de privacidade">
      <p>Esta política explica quais dados o Residência OS guarda, para quê e como você controla isso, nos termos da Lei Geral de Proteção de Dados (Lei 13.709/2018). O controlador dos dados é {r.nome}.</p>

      <h2>1. Dados que guardamos</h2>
      <ul>
        <li><b>Conta:</b> e-mail e senha (a senha é guardada cifrada pelo serviço de autenticação; ninguém consegue lê-la).</li>
        <li><b>Seu estudo:</b> o que você cria e registra no app — data da prova, tempo de estudo por dia, disciplinas, assuntos, cronograma, revisões, compromissos, respostas a questões e provas, caderno de erros, simulados, metas, XP e configurações.</li>
        <li><b>Arquivos que você envia:</b> PDFs e documentos importados e as figuras das questões.</li>
        <li><b>Mensagens:</b> o que você envia em Sugestões, com a página de onde veio e o tipo de navegador.</li>
        <li><b>Erros do site:</b> quando uma tela falha, o app registra a mensagem do erro, a página, o navegador e a conta, para a falha poder ser corrigida.</li>
      </ul>
      <p>Não pedimos nome, CPF, telefone nem dados de saúde, e você não deve enviar dados de pacientes.</p>

      <h2>2. Para que usamos</h2>
      <ul>
        <li>Fazer o app funcionar para você: montar o plano, as revisões e o desempenho (execução do serviço que você pediu ao criar a conta).</li>
        <li>Enviar o lembrete diário por e-mail, só se você ligar essa opção em Configurações.</li>
        <li>Responder às suas mensagens e corrigir erros do app.</li>
      </ul>
      <p>Não vendemos dados, não mostramos anúncios e não usamos ferramentas de análise de comportamento ou rastreamento de terceiros.</p>

      <h2>3. Quem mais participa</h2>
      <p>Para funcionar, o app usa estes serviços, que tratam os dados em nosso nome e podem guardá-los fora do Brasil:</p>
      <ul>
        <li><b>Supabase:</b> banco de dados, login e armazenamento de arquivos.</li>
        <li><b>Vercel:</b> hospedagem do site.</li>
        <li><b>Resend:</b> envio do lembrete por e-mail (só o seu e-mail e o conteúdo do lembrete).</li>
      </ul>
      <p>A administração do app consegue ver as mensagens que você envia e os erros registrados. Seus dados de estudo são protegidos por regras de acesso por conta: as outras pessoas que usam o app não os veem.</p>

      <h2>4. Cookies e armazenamento no aparelho</h2>
      <p>Usamos só o necessário: cookies de sessão (para manter você conectado) e de preferências deste aparelho (menu recolhido, tamanho do texto), e o armazenamento local do navegador para não perder uma prova em andamento. Nada disso é usado para publicidade.</p>

      <h2>5. Por quanto tempo</h2>
      <p>Enquanto a conta existir. Ao usar &quot;Apagar tudo&quot;, os dados de estudo são apagados na hora. Ao pedir a exclusão da conta, apagamos também o e-mail e o login. Os registros de erro são apagados periodicamente.</p>

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
