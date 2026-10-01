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
7. **Opcional:** em Vercel → Settings → Functions, escolha a região mais próxima do seu projeto Supabase (ex.: São Paulo).

Problemas comuns: build falha (leia o log da Vercel); tela de login em loop (variáveis de ambiente ausentes ou com valor errado); app lento (regiões distantes entre Vercel e Supabase); projeto Supabase gratuito pausa após 7 dias sem uso (reative no painel).
