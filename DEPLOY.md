# Publicar na Vercel

1. **Teste local:** `npm run build` e `npm test` devem passar. A Vercel faz o mesmo build; erro de tipo no build local = erro na Vercel.
2. **Supabase:** confirme que as migrações 0001 a 0012 foram executadas no projeto que será usado em produção.
3. **GitHub:** crie um repositório **privado** e envie o projeto. Confira com `git status` que `.env.local` NÃO aparece (o `.gitignore` já o exclui).
   ```
   git init && git add . && git commit -m "Residência OS"
   git branch -M main && git remote add origin <URL-do-repositório> && git push -u origin main
   ```
4. **Vercel:** vercel.com → Add New → Project → importe o repositório (Next.js é detectado sozinho).
   Em *Environment Variables*, crie as duas variáveis com os mesmos valores do seu `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   Clique em Deploy.
5. **Supabase → Authentication → URL Configuration:** coloque o endereço da Vercel (`https://SEU-APP.vercel.app`) em *Site URL* e `https://SEU-APP.vercel.app/**` em *Redirect URLs*.
6. **Celular:** abra o endereço, entre com seu e-mail e senha e use "Adicionar à tela inicial" (Chrome: menu ⋮; Safari: Compartilhar).
7. **Região:** o `vercel.json` fixa as funções em `yul1` (Montréal), a mesma região do Supabase deste projeto (ca-central-1). Se o Supabase mudar de região, troque esse código (São Paulo = `gru1`; lista em vercel.com/docs/regions). A página /diagnostico mostra a região e o tempo de uma consulta ao banco.

Problemas comuns: build falha (leia o log da Vercel); tela de login em loop (variáveis de ambiente ausentes ou com valor errado); app lento (regiões distantes entre Vercel e Supabase); projeto Supabase gratuito pausa após 7 dias sem uso (reative no painel).

## Esqueci minha senha (e-mail de recuperação)
Funciona com o e-mail **padrão** do Supabase (em inglês). Não é preciso editar o modelo do e-mail, que fica bloqueado sem SMTP próprio.
1. **Supabase → Authentication → URL Configuration:** *Site URL* = endereço da Vercel e, em *Redirect URLs*, `https://SEU-APP.vercel.app/**`. Sem isso, o link do e-mail não volta para o app.
2. Opcional, mais tarde: configurar um SMTP próprio (por exemplo, Resend) melhora a entrega, tira o limite de poucos e-mails por hora e permite escrever o e-mail em português.

## Lembrete diário por e-mail
1. **Banco:** rode `supabase/migrations/0015_lembretes_email.sql` no SQL Editor.
2. **Resend** (resend.com, grátis): crie a conta **com o mesmo e-mail da sua conta no app**, abra *API Keys* e crie uma chave (`re_...`). Sem domínio próprio, o Resend só envia para o e-mail da própria conta Resend.
3. **Supabase → Project Settings → API:** copie a chave **service_role** (é SECRETA: nunca a coloque no código nem a envie a ninguém).
4. **Vercel → Settings → Environment Variables:** crie `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `CRON_SECRET` (um texto longo e aleatório, só seu). Depois faça um **Redeploy**.
5. O arquivo `vercel.json` agenda o envio todo dia às 10:00 UTC (7h em Brasília; o plano gratuito pode atrasar até uma hora). Confira em *Vercel → Settings → Cron Jobs*.
6. No app: Configurações → Lembretes por e-mail → ative e use **"Enviar um e-mail de teste agora"**.
