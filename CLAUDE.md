# Luz — Plataforma de agendamento para barbearias/salões

Contexto para o Claude Code. O status de produto completo está em `../STATUS-DO-PROJETO.md` (na pasta acima de `app/`). **Leia esse arquivo antes de começar.**

## Stack e ambiente
- Next.js 15 (App Router) + TypeScript + Prisma 5 + PostgreSQL + MUI 6. O idioma do produto e do código (comentários) é **português**.
- **Produção:** https://luz-virid.vercel.app. Vercel no time `luz-3f4d`, projeto `luz` (`prj_ahDzyk8Po5NC8zZRFWSvnwMuynJM`). O banco é Postgres na Neon. **Hoje a produção está na versão anterior ao roadmap de outubro** (commit `56dc1c2`) — ver "Estado atual" abaixo.
- **Deploy:** um push na `main` do GitHub `lpo19Lucas/luz` gera o deploy de produção. O script `build` roda `prisma generate && prisma migrate deploy && next build`, então **as migrations são aplicadas no banco de produção durante o build**.
  - ⚠️ A env `DATABASE_URL` vale também para o target *preview*. Um push em outra branch gera um preview que **também roda as migrations no banco de produção**. Mantenha as migrations sempre **aditivas** (só adicionar).
- **Local:** `docker compose up --build` sobe o app em http://localhost:3000 com Postgres de dev e de teste. Veja o `README.md` para os detalhes do Windows (polling e o `NODE_ENV` no build).
- **Testes:** `docker compose exec app npm run test:integration` roda Jest contra o Postgres real `postgres_test`. `docker compose exec app npm test` roda os testes de unidade (jsdom, sem banco). Rode também `npx tsc --noEmit` e `npm run lint`.
  - O `npm ci` com npm 11 reclama que o lockfile está fora de sincronia. Use `npm install` uma vez e faça commit do `package-lock.json` atualizado.
  - ⚠️ **Não rode `npm run build` (produção) dentro do mesmo container que roda `npm run dev`** — os dois compartilham o volume `app_next` (`.next`) e o build de produção corrompe o cache do dev server (já aconteceu duas vezes nesta branch). Se acontecer, recupere com `docker compose stop app && docker compose rm -f app && docker volume rm app_app_next && docker compose up -d app`. Pra validar o build de produção de verdade, rode isolado (container separado, ou com o dev server parado).
- **Timezone:** sempre use `src/lib/timezone.ts` (UTC-3 fixo). Nunca use `toLocaleString` sem `timeZone` em Server Components, porque a Vercel roda em UTC. Pra um **instante de verdade** (ex. `Appointment.startAt`), use `salonCalendarDay()` pra achar o dia certo em Brasília antes de bucketizar — `salonMidnightUTC()`/`salonWeekday()` ignoram a hora e só servem pra "marcadores de dia" (Date com hora 0 UTC, como os que vêm de inputs `type="date"`). Ver o comentário em `timezone.ts` — foi um bug real descoberto nos testes de `booking.ts`.

## Convenções do código
- Multi-tenant: toda query do dashboard filtra por `salonId` do `getCurrentSalon()` (`src/lib/currentSalon.ts`), que também protege as rotas.
- Mutação do dashboard é feita com **server action** em `src/lib/actions/*.ts` mais `<form action={...}>` em Server Component. Rotas `/api/*` servem só o público (cliente sem login, autenticado pelo `accessToken` do agendamento) e o `/api/owner/appointments` (protegido por sessão, usado pelo agendamento manual do dono).
- A lógica de negócio fica em `src/lib/*.ts` como funções puras ou com prisma, testadas por `*.integration.test.ts` (Postgres real) ou `*.test.ts` (unidade, sem banco — ex. `src/lib/subscriptionAccess.test.ts`). As actions e rotas só chamam essas funções.
- **Fluxo de agendamento:** tudo passa por `src/lib/booking.ts` (`createAppointment`, `cancelAppointmentByToken`/`cancelAppointmentById`, `confirmPresenceByToken`, `rescheduleAppointmentByToken`) — nunca mexa em `Appointment` direto numa rota ou action nova. Erros são `BookingError` com um `code`, traduzidos pra HTTP por `src/lib/bookingErrors.ts`.
- Novas tabelas precisam entrar no `TRUNCATE` de `tests/integration/helpers.ts`. `createTestSalon()` já cria vínculo profissional-serviço, disponibilidade o dia inteiro e assinatura (`TRIAL`) válida por padrão — use os overrides (`published`, `subscriptionAccess`, `presenceConfirmationEnabled`) pra testar os casos de bloqueio.
- Commits em português, explicando o porquê. Um commit por feature, com tsc/lint/testes passando antes de cada um.
- **Admin (`/admin`):** toda server action em `src/lib/actions/admin.ts` começa com `requireAdmin()` — o layout protegido NÃO protege a action (server action é endpoint público). Regras em `src/lib/adminSalons.ts`; `src/lib/actions/admin.integration.test.ts` tem a regressão que chama cada action sem sessão — inclua ali toda action nova.
- **Cadastro de salão:** sempre por `provisionSalon` (`src/lib/salonProvisioning.ts`, uma transação) — usado pelo `/cadastro` e pelo cadastro facilitado do admin.
- **Planos/preços/dias de teste:** vêm da tabela `platform_plans` (`getPlatformPlans`/`getPaidPlans`/`getTrialDays` em `src/lib/plans.ts`), editável em `/admin/planos`. Não hardcode preço. A tabela fica fora do `TRUNCATE` dos testes; quem mexe nela chama `restoreDefaultPlans()`.
- **Senha/sessão:** `passwordChangedAt`/`disabledAt` derrubam sessões em `getCurrentSalon` (`isSessionStillValid`). Depois de trocar a senha do próprio usuário logado, chame `createSession` de novo. Links de senha em `src/lib/passwordReset.ts` (só o hash do token no banco). Login e `/admin` têm limite de tentativas (`src/lib/rateLimit.ts`, tabela `auth_attempts`).
- **Termos/LGPD:** textos em `src/lib/legalTexts.ts`, dados da empresa por env `LEGAL_*` (`src/lib/legal.ts`). Mudou o texto de forma relevante → suba `LEGAL_VERSION` (o painel pede novo aceite a quem aceitou a versão anterior).
- **Imagens de profissional/serviço:** `src/lib/storedImages.ts` (`setEntityImage`, `readImageField`) + componente `ImageUploadField` + rota `/api/images/:id`. Nunca selecione `StoredImage.data` em listagens.

## Atualização 06/10/2026 — branch `feature/admin-acesso-imagens`
Criada a partir de `redesign/fase-g-layout` (Fase G + pacotes/avaliações/comissão). 4 commits, cada um com tsc + lint + testes (28 de unidade, 174 de integração):
1. Termos de Uso, Política de Privacidade (LGPD) e Contrato (`/termos`, `/privacidade`, `/contrato`) com aceite no cadastro; `provisionSalon` em transação; planos no banco; limite de tentativas de login.
2. Recuperação de acesso (`/esqueci-senha`, `/redefinir-senha/[token]`, alterar senha em Configurações) — e-mail via Resend (`RESEND_API_KEY`, opcional).
3. Painel admin completo (visão geral, salões, detalhe, cadastro facilitado com convite, planos) + correção de segurança no `setSubscriptionStatusAction`.
4. Fotos de profissionais e serviços.

Migration nova (aditiva): `20261006000000_admin_acesso_imagens`. Env vars novas (todas opcionais, em `.env.example`): `RESEND_API_KEY`, `EMAIL_FROM`, `LEGAL_COMPANY_NAME`, `LEGAL_CNPJ`, `LEGAL_ADDRESS`, `LEGAL_CONTACT_EMAIL`, `LEGAL_DPO_NAME`, `LEGAL_DPO_EMAIL`, `LEGAL_FORUM_CITY`.

⚠️ Os textos jurídicos são uma base — revisar com advogado antes de operar comercialmente.

## Estado atual (02/10/2026)
Branch local: **`dev/roadmap-outubro`**, que ainda não foi enviada ao GitHub. A `main`/produção está no commit `56dc1c2`, anterior a essa branch.

**Fases A, B, C e D do roadmap estão implementadas, testadas (tsc + lint + 64 testes de integração + 9 de unidade) e commitadas** — 15 commits ao todo. Ver `../STATUS-DO-PROJETO.md` pra lista completa do que foi feito em cada fase. Resumo rápido do que já existe e pode ser reusado:
- `src/lib/booking.ts` — fluxo de agendamento centralizado.
- `src/lib/agendaKpis.ts`, `src/lib/agendaBlocks.ts`, `src/lib/clientStats.ts`, `src/lib/subscriptionAccess.ts`, `src/lib/plans.ts`, `src/lib/aiDescription.ts` — lógica de negócio por feature.
- `/inicio`, `/bloqueios`, `/historico`, `/clientes`, `/clientes/[id]`, `/agenda/novo`, `/ajuda` — telas novas do dashboard.
- Barra lateral esquerda no dashboard (`src/app/(dashboard)/layout.tsx`) no lugar da AppBar horizontal antiga.
- `/` — landing page. `/[salonSlug]` — Server Component com tema dinâmico, JSON-LD, perfil público (capa/cores/redes/endereço).
- `sitemap.ts`, `robots.ts`, `/llms.txt`.

**Ainda não validado:** `next build` de produção limpo de ponta a ponta nesta branch (ver nota técnica acima sobre o cache corrompido). Fazer isso é o próximo passo antes de qualquer coisa.

## Plano de implementação — o que falta

**Fase E — WhatsApp e mensagens**
- **F9:** `/mensagens` com um editor de template por tipo (`BOOKING_CONFIRMATION`, `REMINDER`, `PRESENCE_CHECK`) e as variáveis `{nome} {telefone} {servico} {profissional} {data} {hora} {salao} {link}`, mais uma pré-visualização. O modelo `MessageTemplate` já existe no schema. Crie `src/lib/messageTemplates.ts` com os textos padrão e a função `renderTemplate`, e use isso no cron (`src/app/api/cron/whatsapp-jobs/route.ts`). O envio real continua `console.log` até escolher o provedor (decisão em aberto — perguntar ao Lucas: Meta oficial vs. Z-API).
- **B4** (cron de hora em hora): fica pra quando o WhatsApp for integrado de verdade, porque o plano Hobby da Vercel só permite cron diário — precisaria de Vercel Pro ou um cron externo (ex. GitHub Actions, cron-job.org batendo no endpoint com `CRON_SECRET`).

**Fase F — Receita extra e qualidade**
- **F13:** `/produtos` com CRUD e foto (mesma técnica da capa — `resizeImageToDataURL` + rota de servir a imagem) e a lista de reservas com status. Os modelos `Product` e `ProductReservation` já existem no schema. Na página pública, uma seção "Produtos" com "Reservar para retirar" (nome e telefone, que recusa banido via a mesma lógica de `booking.ts`) e "Pedir pelo WhatsApp".
- **B7:** UI pros flags `paidSelfReported`/`paidConfirmedByOwner` do `Appointment` — hoje existem no banco mas não aparecem em lugar nenhum.
- Testes de componente e E2E com Playwright (`e2e/` existe mas está vazio/não expandido — `npx playwright install --with-deps chromium` primeiro).

**Antes do deploy (checklist, não é uma fase):**
1. Confirmar `next build` de produção limpo (isolado do container de dev — ver nota técnica acima).
2. `git push` da branch `dev/roadmap-outubro` e merge na `main` (ou abrir PR, se o Lucas preferir revisar antes).
3. Configurar na Vercel as env vars novas: `PLATFORM_PIX_KEY`, `NEXT_PUBLIC_SUPPORT_WHATSAPP`, `NEXT_PUBLIC_SALES_WHATSAPP`, `AI_GATEWAY_API_KEY` (opcional), `APP_URL` (quando houver domínio) — todas documentadas em `.env.example`.
4. Perguntar ao Lucas se as Fases E/F entram antes desse primeiro deploy do roadmap, ou se ele quer subir o que já está pronto (A–D) e continuar depois.

## Decisões em aberto (perguntar ao Lucas)
- Provedor de WhatsApp: Meta oficial ou Z-API e similares (bloqueia F9 e B4).
- Valores reais das env vars já criadas: `PLATFORM_PIX_KEY`, `NEXT_PUBLIC_SUPPORT_WHATSAPP`, `NEXT_PUBLIC_SALES_WHATSAPP`.
- Domínio próprio (`APP_URL`).
- Ordem: Fases E/F antes ou depois do primeiro deploy do roadmap de outubro.
