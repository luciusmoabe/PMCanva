# Configuracao do Supabase

A aplicacao usa o projeto Supabase configurado em `app/.env.local`.

## Criar a tabela

1. Abra o SQL Editor do projeto Supabase.
2. Execute o arquivo [supabase/schema.sql](supabase/schema.sql).
3. Reinicie o servidor Vite com `npm run dev` dentro de `app`.

O schema cria `public.project_canvases`, ativa RLS e libera somente o registro de demonstracao `projectly-demo-canvas` para o prototipo sem autenticacao.

O frontend tambem abre uma assinatura Supabase Realtime para esse registro. No painel do Supabase, confirme que `project_canvases` esta incluida na publicacao `supabase_realtime` para que alteracoes feitas por outro navegador sejam recebidas imediatamente.

## Producao

Antes de disponibilizar o sistema para usuarios reais:

- habilite Supabase Auth;
- associe cada canvas a uma organizacao e a um usuario autenticado;
- substitua as politicas de demonstracao por politicas baseadas em `auth.uid()` e memberships;
- mantenha a chave publishable no frontend, nunca uma service role key;
- remova o fallback anonimo das policies.
