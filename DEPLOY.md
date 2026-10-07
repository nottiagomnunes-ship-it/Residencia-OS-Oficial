# Publicar na Vercel

1. **Teste local:** `npm run build` e `npm test` devem passar. A Vercel faz o mesmo build; erro de tipo no build local = erro na Vercel.
2. **Supabase:** confirme que as migrações 0001 a 0012 foram executadas no projeto que será usado em produção.
3. **GitHub:** crie um repositório **privado** e envie o projeto. Confira com `git status` que `.env.local` NÃO aparece (o `.gitignore` já o exclui).
   ```
   git init && git add . && git commit -m "R1TMO"
   git branch -M main && git remote add origin <URL-do-repositório> && git push -u origin main
   ```
4. **Vercel:** vercel.com → Add New → Project → importe o repositório (Next.js é detectado sozinho).
   Em *Environment Variables*, crie as duas variáveis com os mesmos valores do seu `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   Clique em Deploy.
5. **Supabase → Authentication → URL Configuration:** coloque o endereço do app (`https://r1tmo.com.br`) em *Site URL* e `https://r1tmo.com.br/**` em *Redirect URLs*.
6. **Celular:** abra o endereço, entre com seu e-mail e senha e use "Adicionar à tela inicial" (Chrome: menu ⋮; Safari: Compartilhar).
7. **Região:** o `vercel.json` fixa as funções em `yul1` (Montréal), a mesma região do Supabase deste projeto (ca-central-1). Se o Supabase mudar de região, troque esse código (São Paulo = `gru1`; lista em vercel.com/docs/regions). A página /diagnostico mostra a região e o tempo de uma consulta ao banco.

Problemas comuns: build falha (leia o log da Vercel); tela de login em loop (variáveis de ambiente ausentes ou com valor errado); app lento (regiões distantes entre Vercel e Supabase); projeto Supabase gratuito pausa após 7 dias sem uso (reative no painel).

## Domínio próprio (r1tmo.com.br)
1. **Vercel → Settings → Domains:** adicione `r1tmo.com.br` e `www.r1tmo.com.br` (deixe o `www` redirecionando para `r1tmo.com.br`). A Vercel mostra os registros DNS: crie-os no **registro.br → domínio → DNS → Editar zona**, copiando nome, tipo e valor. Espere aparecer "Valid Configuration".
2. **Vercel → Environment Variables:** `DOMINIO_PRINCIPAL` = `r1tmo.com.br` e `SITE_URL` = `https://r1tmo.com.br` (links do lembrete por e-mail). Com `DOMINIO_PRINCIPAL`, quem abrir `r1tmo.vercel.app` vai sozinho para o endereço novo (o middleware faz isso; `/api/` fica de fora, para o agendador do lembrete). **Só crie essa variável depois que `https://r1tmo.com.br` abrir.** Redeploy.
3. **Supabase → Authentication → URL Configuration:** *Site URL* `https://r1tmo.com.br`; *Redirect URLs* `https://r1tmo.com.br/**` (pode manter `https://r1tmo.vercel.app/**` por um tempo, para links de e-mail já enviados).
4. **Celular:** o app instalado pelo endereço antigo é outro app para o navegador. Desinstale, abra `https://r1tmo.com.br` no Chrome, ⋮ → **Instalar app** e entre de novo. Os dados são os mesmos (ficam no Supabase).

## E-mails de cadastro e "Esqueci minha senha" (SMTP próprio com o Resend)
Sem SMTP próprio, o Supabase só entrega para os e-mails da equipe do projeto e no máximo 2 por hora: testadores não recebem a confirmação nem a recuperação de senha.
1. **Resend → Domains → Add domain:** `r1tmo.com.br` (região São Paulo, se houver). Crie no **registro.br → DNS → Editar zona** os registros TXT e MX que o Resend mostrar (no nome, só a parte antes do domínio, ex.: `send`, `resend._domainkey`). Clique em **Verify** até ficar *Verified*.
2. **Resend → API Keys:** crie uma chave com *Sending access* restrita a `r1tmo.com.br`.
3. **Supabase → Authentication → Emails → SMTP Settings → Enable custom SMTP:** remetente `nao-responda@r1tmo.com.br`, nome `R1TMO`, host `smtp.resend.com`, porta `465`, usuário `resend`, senha = a chave.
4. **Supabase → Authentication → Rate Limits:** "emails per hour" para ~60 (o plano grátis do Resend tem limite diário e mensal).
5. **Supabase → Authentication → Emails → Templates** (em português; mantenha `{{ .ConfirmationURL }}`, que é o que o app usa):
   - *Confirm signup* — assunto "Confirme seu cadastro no R1TMO": `<h2>Bem-vindo ao R1TMO</h2><p>Falta só confirmar o seu e-mail para começar o seu plano de estudos.</p><p><a href="{{ .ConfirmationURL }}">Confirmar meu e-mail</a></p><p>Se não foi você que criou a conta, ignore este e-mail.</p>`
   - *Reset password* — assunto "Redefinir sua senha do R1TMO": `<h2>Redefinir a senha</h2><p>Recebemos um pedido para trocar a senha da sua conta no R1TMO.</p><p><a href="{{ .ConfirmationURL }}">Criar uma nova senha</a></p><p>Se não foi você, ignore este e-mail: sua senha continua a mesma.</p>`
6. Deixe **"Confirm email"** ligado. Teste com um e-mail que não seja o seu: cadastro, link de confirmação e "Esqueci minha senha".

## Lembrete diário por e-mail
1. **Banco:** rode `supabase/migrations/0015_lembretes_email.sql` no SQL Editor.
2. **Resend** (resend.com, grátis): com o domínio `r1tmo.com.br` verificado (seção acima), crie uma chave (`re_...`) em *API Keys*. Sem domínio verificado, o Resend só envia para o e-mail da própria conta Resend.
3. **Supabase → Project Settings → API:** copie a chave **service_role** (é SECRETA: nunca a coloque no código nem a envie a ninguém).
4. **Vercel → Settings → Environment Variables:** crie `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` (um texto longo e aleatório, só seu) e `EMAIL_FROM` = `R1TMO <lembretes@r1tmo.com.br>`. Depois faça um **Redeploy**.
5. O arquivo `vercel.json` agenda o envio todo dia às 10:00 UTC (7h em Brasília; o plano gratuito pode atrasar até uma hora). Confira em *Vercel → Settings → Cron Jobs*.
6. No app: Configurações → Lembretes por e-mail → ative e use **"Enviar um e-mail de teste agora"**.

## Entrar com o Google (opcional)

O botão "Continuar com o Google" só aparece com `LOGIN_GOOGLE=ligado`. Configure nesta ordem:

1. **Google Cloud Console** (console.cloud.google.com), num projeto novo "R1TMO":
   - **APIs e serviços → Tela de consentimento OAuth** (ou "Google Auth Platform"): tipo **Externo**; nome do app "R1TMO"; e-mail de suporte; domínio autorizado `r1tmo.com.br`; página inicial `https://r1tmo.com.br`; links `https://r1tmo.com.br/privacidade` e `https://r1tmo.com.br/termos`. Escopos: só `email`, `profile` e `openid` (não exigem verificação do Google). **Publique o app** ("Em produção"); em "Teste", só os e-mails listados como testadores conseguem entrar.
   - **Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web.** Em "URIs de redirecionamento autorizados", cole a URL de callback que o Supabase mostra no passo 2 (`https://<seu-projeto>.supabase.co/auth/v1/callback`). Copie o **ID do cliente** e a **chave secreta**.
2. **Supabase → Authentication → Sign In / Providers → Google:** ligue, cole o ID do cliente e a chave secreta e salve.
3. **Supabase → Authentication → URL Configuration:** Site URL `https://r1tmo.com.br`; em Redirect URLs, garanta `https://r1tmo.com.br/**` (ou pelo menos `https://r1tmo.com.br/auth/confirm`), e `http://localhost:3000/**` se for testar no computador.
4. **Vercel → Settings → Environment Variables:** `LOGIN_GOOGLE` = `ligado` (Production). Depois, **Redeploy**.
5. Teste com a sua conta (mesmo e-mail da conta administradora: deve cair na mesma conta, com a Administração) e com uma conta Google nova (deve abrir o assistente inicial).
