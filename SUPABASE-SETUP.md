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

## Envio de e-mail para convites (Resend)

Convidar alguém na tela "Equipe" cria o convite no banco e tenta enviar um e-mail de verdade via uma Supabase Edge Function (`supabase/functions/send-invitation-email`). Se a function não estiver implantada ou a chave não estiver configurada, o convite continua sendo criado normalmente — só aparece um aviso de que o e-mail não saiu, e você avisa a pessoa por fora, como já acontecia antes.

Para ativar o envio de verdade:

1. Crie uma conta em [resend.com](https://resend.com) (tem plano gratuito) e gere uma API key em **API Keys**.
2. Instale/atualize a Supabase CLI (`npm install -g supabase` ou `npx supabase --version`) e faça login: `supabase login`.
3. Vincule este projeto ao seu projeto Supabase: `supabase link --project-ref <seu-project-ref>` (o ref aparece na URL do painel, `https://supabase.com/dashboard/project/<ref>`).
4. Configure a chave como secret da function: `supabase secrets set RESEND_API_KEY=sua_api_key`.
5. Implante a function: `supabase functions deploy send-invitation-email`.
6. (Opcional) Sem verificar um domínio próprio no Resend, os e-mails só saem usando o remetente de teste `onboarding@resend.dev` — funciona para qualquer destinatário, mas identifica o remetente como "via resend.dev". Para usar seu próprio domínio, verifique-o no Resend e defina `supabase secrets set RESEND_FROM="Seu Nome <voce@seudominio.com>"`.

Sem esses passos, tudo no app continua funcionando exatamente como antes — o e-mail é a única peça opcional.

## O que ainda falta

Este schema cobre autenticacao e isolamento multi-tenant reais, alem de governanca (trava por bloco/projeto, trilha de auditoria, snapshot de versao imutavel), MFA e link de leitura publica — ver `PLANO-SOLUCAO-SAAS.md`, secoes 2 e 14 para o estado atualizado. O unico item de infraestrutura que depende de voce configurar por fora e o envio real de e-mail (acima); SSO corporativo e revogacao de sessao ainda nao foram iniciados.
