# Configuracao do Supabase

A aplicacao usa o projeto Supabase configurado em `app/.env.local`.

## Criar o schema

1. Abra o SQL Editor do projeto Supabase.
2. Execute o arquivo [supabase/schema.sql](supabase/schema.sql).
3. Reinicie o servidor Vite com `npm run dev` dentro de `app`.

O schema cria `organizations`, `memberships`, `projects` e `notes`, com RLS baseada em `auth.uid()` e nas memberships de cada organizacao (ver `PLANO-SOLUCAO-SAAS.md`). **Ele derruba a antiga tabela `project_canvases`** — os dados do prototipo de demonstracao sao descartados de proposito, sem migracao.

O schema tambem cria as funcoes `is_org_member`, `is_org_editor` (helpers de RLS) e `create_organization_with_owner` (cria uma organizacao e ja adiciona quem chamou como `admin`). E seguro executar o arquivo novamente a qualquer momento.

## Autenticacao

A aplicacao usa Supabase Auth com dois metodos: e-mail + senha e link magico (OTP por e-mail).

1. No painel do Supabase, em **Authentication → Providers**, confirme que o provider **Email** esta habilitado. O mesmo provider cobre tanto cadastro com senha quanto o link magico (`signInWithOtp`) — nao ha uma chave separada para ativar.
2. Em **Authentication → URL Configuration**, defina a Site URL como `http://localhost:5173` em desenvolvimento (ajuste para o dominio de producao mais tarde). Isso e necessario para que o link de confirmacao de cadastro e o link magico levem de volta para o app correto.
3. Por padrao o Supabase exige confirmacao por e-mail antes de liberar uma sessao: apos `signUp`, o usuario so consegue entrar depois de clicar no link recebido. O mesmo vale para o link magico. A tela de login do app (`AuthScreen`) ja mostra o aviso "verifique seu e-mail" nesses casos.

## Realtime

O frontend abre uma assinatura Supabase Realtime por projeto ativo (`notes` e `projects`). No painel do Supabase, em **Database → Publications**, confirme que `projects` e `notes` estao incluidas na publicacao `supabase_realtime` — o script `supabase/schema.sql` ja faz isso automaticamente, essa checagem e só para depurar caso a sincronizacao pareca nao funcionar.

## O que ainda falta

Este schema cobre autenticacao e isolamento multi-tenant reais. Ainda ficam para as proximas etapas (ver `PLANO-SOLUCAO-SAAS.md`, secao 14): convite de membros por e-mail (hoje so quem cria a organizacao vira membro), versionamento imutavel do canvas, aprovacao por bloco, exportacao em PDF/PNG, trilha de auditoria real e MFA/SSO.
