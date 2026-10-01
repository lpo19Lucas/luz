# Luz — Plataforma de agendamento para barbearias/salões

Contexto para o Claude Code. O status de produto completo está em `../STATUS-DO-PROJETO.md` (na pasta acima de `app/`). **Leia esse arquivo antes de começar.**

## Stack e ambiente
- Next.js 15 (App Router) + TypeScript + Prisma 5 + PostgreSQL + MUI 6. O idioma do produto e do código (comentários) é **português**.
- **Produção:** https://luz-virid.vercel.app. Vercel no time `luz-3f4d`, projeto `luz` (`prj_ahDzyk8Po5NC8zZRFWSvnwMuynJM`). O banco é Postgres na Neon.
- **Deploy:** um push na `main` do GitHub `lpo19Lucas/luz` gera o deploy de produção. O script `build` roda `prisma generate && prisma migrate deploy && next build`, então **as migrations são aplicadas no banco de produção durante o build**.
  - ⚠️ A env `DATABASE_URL` vale também para o target *preview*. Um push em outra branch gera um preview que **também roda as migrations no banco de produção**. Mantenha as migrations sempre **aditivas** (só adicionar).
- **Local:** `docker compose up --build` sobe o app em http://localhost:3000 com Postgres de dev e de teste. Veja o `README.md` para os detalhes do Windows (polling e o `NODE_ENV` no build).
- **Testes:** `docker compose exec app npm run test:integration` roda Jest contra o Postgres real `postgres_test`. Rode também `npx tsc --noEmit` e `npm run lint`.
  - O `npm ci` com npm 11 reclama que o lockfile está fora de sincronia. Use `npm install` uma vez e faça commit do `package-lock.json` atualizado.
- **Timezone:** sempre use `src/lib/timezone.ts` (UTC-3 fixo). Nunca use `toLocaleString` sem `timeZone` em Server Components, porque a Vercel roda em UTC.

## Convenções do código
- Multi-tenant: toda query do dashboard filtra por `salonId` do `getCurrentSalon()` (`src/lib/currentSalon.ts`), que também protege as rotas.
- Mutação do dashboard é feita com **server action** em `src/lib/actions/*.ts` mais `<form action={...}>` em Server Component. Rotas `/api/*` servem só o público (cliente sem login, autenticado pelo `accessToken` do agendamento).
- A lógica de negócio fica em `src/lib/*.ts` como funções puras ou com prisma, testadas por `*.integration.test.ts` (veja `src/lib/appointmentOutcome.integration.test.ts`). As actions e rotas só chamam essas funções.
- Novas tabelas precisam entrar no `TRUNCATE` de `tests/integration/helpers.ts`.
- Commits em português, explicando o porquê.

## Estado atual (01/10/2026)
Branch local: **`dev/roadmap-outubro`**, que ainda não foi enviada ao GitHub. A `main` está igual à produção.

1. ✅ **Commit `43aac36` (B1):** botões "Concluído", "Não compareceu" e "Desfazer" na agenda, mais o novo status `NO_SHOW` (migration `20261001230000`) e as métricas corrigidas. tsc, lint e 38 testes de integração passaram num ambiente Linux limpo.
2. 🚧 **Trabalho em andamento, ainda não commitado nem testado:**
   - `prisma/schema.prisma` com todos os modelos novos do roadmap: campos de perfil e `publishedAt` no `Salon`, `AgendaBlock`, `AppointmentEvent`, `AppointmentSource`, `bannedAt`/`banReason`/`notes` no `Client`, `MessageTemplate`, `Product` e `ProductReservation`.
   - `prisma/migrations/20261002000000_roadmap_outubro/migration.sql`, escrita à mão. Além de criar as estruturas, ela publica os salões existentes, copia `availability_exceptions` para `agenda_blocks` e normaliza os telefones dos clientes para só dígitos.
   - **Valide** com `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url <db vazio>`. O diff precisa sair vazio.
   - Helpers novos: `src/lib/phone.ts`, `src/lib/appUrl.ts` e `src/lib/appointmentEvents.ts`.

## Plano de implementação (o Lucas pediu: "desenvolva tudo, teste local e suba para produção")
Siga a ordem e faça um commit por item, cada um com testes.

**Fase A**
- **Refatorar a criação, o cancelamento e o reagendamento** para `src/lib/booking.ts`, usado pelas rotas e pelas actions do dono. A refatoração deve:
  - validar que o profissional pertence ao salão, está ativo e faz o serviço (hoje a rota não valida isso);
  - no fluxo público, validar que o horário está em `getAvailableSlots` (hoje dá para mandar um POST com qualquer horário);
  - normalizar o telefone com `normalizePhone`;
  - recusar cliente banido com a mensagem neutra "Não foi possível agendar. Entre em contato com o salão.";
  - registrar um `AppointmentEvent` (CREATED, CANCELLED, RESCHEDULED com o horário antigo e o novo, PRESENCE_CONFIRMED) com o ator CLIENT, OWNER ou SYSTEM. O cron de no-show com `RELEASE_SLOT` registra CANCELLED com ator SYSTEM, e `setAppointmentOutcome` registra COMPLETED, NO_SHOW ou OUTCOME_REVERTED com ator OWNER.
- **F2:** um cabeçalho na `/agenda` com KPIs do dia e da semana: agendados, concluídos, faltas, faturamento previsto (não cancelados) e realizado (COMPLETED).
- **B3:** `/agenda/novo`, o agendamento pelo dono, feito como formulário server-side. Escolher profissional, serviço e data via query string, listar os horários livres e permitir um horário de encaixe livre (que só checa conflito). `source = OWNER`. O card da agenda ganha os botões "Cancelar" e "Remarcar" (o remarcar abre `/[slug]/agendamento/[token]`).
- **F4:** `/bloqueios` com CRUD de `AgendaBlock`: ONCE, DAILY ou WEEKLY, de um profissional ou do salão inteiro, com dia inteiro ou faixa de horário e período opcional `startsOn`/`endsOn`. O `src/lib/slots.ts` passa a usar `AgendaBlock` (em vez de `AvailabilityException`) e considera também os bloqueios do salão inteiro. Precisa de testes de recorrência.
- **F5:** `/historico` com a lista de cancelados e remarcados a partir de `AppointmentEvent`, com filtros por tipo e período, e mostrando quem fez e o horário antigo para o novo.
- **F8, F1 e F7:** `/clientes` com busca por nome ou telefone, visitas, total gasto (COMPLETED), ticket, última visita, faltas e link de WhatsApp. `/clientes/[id]` com histórico, anotações e banir/desbanir com motivo.

**Fase B**
- **F3:** a página `/configuracoes` ganha a capa (redimensionada no navegador via canvas para JPEG de até 1280px, guardada como data URL em `coverImageData` e servida por `GET /api/salons/[slug]/cover` com cache), as cores primária e de destaque (validar `#RRGGBB`), redes sociais, endereço, CNPJ, e-mail e WhatsApp, tudo opcional. Configure `experimental.serverActions.bodySizeLimit: "3mb"` no `next.config.js`. A página pública vira um Server Component que carrega o salão, aplica o tema com as cores do salão (ThemeProvider client), mostra a capa, endereço, redes e o botão de WhatsApp, e renderiza o `BookingClient`.
- **F12:** `/inicio` com um checklist (dados do salão, ≥1 serviço, ≥1 profissional ativo com horário e serviço vinculado) e um botão "Publicar meu link" que preenche `publishedAt`. O `/cadastro` passa a redirecionar para `/inicio`. Salão sem `publishedAt` mostra a página pública como "em configuração", mas o dono logado vê uma prévia, e as APIs públicas recusam agendamentos. Inclua botão de copiar e compartilhar o link.
- **F11:** `/ajuda` com um FAQ estático de como usar cada feature (accordions).
- **F10:** botão "Suporte" (wa.me) no dashboard e no `/ajuda`, usando a env `NEXT_PUBLIC_SUPPORT_WHATSAPP`. Esconda o botão se a env não existir.

**Fase C**
- **B9:** a chave PIX da plataforma passa a vir da env `PLATFORM_PIX_KEY`. Hoje é um placeholder fixo no código. Mova `PLANS` para `src/lib/plans.ts`.
- **F6:** `src/lib/subscriptionAccess.ts` com a função `getSubscriptionAccess(sub, now)` que retorna `OK`, `GRACE` ou `BLOCKED`, com **5 dias de carência** depois do fim do período (`trialEndsAt` no TRIAL e `currentPeriodEnd` no ACTIVE). Com BLOCKED, o link público mostra "Agenda temporariamente indisponível" e as APIs recusam agendamentos. O dashboard mostra um banner em GRACE e BLOCKED. No `/admin`, ativar soma 30, 90 ou 365 dias conforme o plano a partir de `max(now, currentPeriodEnd)`. Precisa de testes.

**Fase D**
- **F14:** landing page da Luz em `/` (hoje a rota não tem página): hero, dores, como funciona, features, planos (R$ 79 mensal / R$ 69 trimestral / R$ 59 anual, 50 dias grátis), FAQ e CTA para `/cadastro`.
- **F15:**
  - `metadataBase` com `getAppUrl()`.
  - `generateMetadata` em `/[salonSlug]` com Open Graph usando a capa.
  - JSON-LD `HairSalon` (endereço, `openingHoursSpecification` a partir da união das disponibilidades, `makesOffer` com os serviços, `sameAs` com as redes e `FAQPage` a partir de `faqJson`).
  - JSON-LD `Organization`, `SoftwareApplication` e `FAQPage` na landing.
  - `src/app/sitemap.ts` (landing mais os salões publicados e não bloqueados), `robots.ts` (bloqueando dashboard, admin e api) e uma rota `llms.txt`.
  - Botão "Gerar descrição com IA" nas configurações, chamando o Vercel AI Gateway (`https://ai-gateway.vercel.sh/v1/chat/completions`, autenticado por `AI_GATEWAY_API_KEY` ou pelo OIDC da Vercel). Ele gera a descrição e o FAQ, e o dono pode editar.

**Fase E**
- **B5:** o link das mensagens passa a ser `absoluteUrl("/" + salon.slug + "/agendamento/" + token)`.
- **F9:** `/mensagens` com um editor de template por tipo (BOOKING_CONFIRMATION, REMINDER, PRESENCE_CHECK) e as variáveis `{nome} {telefone} {servico} {profissional} {data} {hora} {salao} {link}`, mais uma pré-visualização. Crie `src/lib/messageTemplates.ts` com os textos padrão e a função `renderTemplate`, e use isso no cron. O envio real continua `console.log` até escolher o provedor.
- **B4** (cron de hora em hora) fica para quando o WhatsApp for integrado, porque o plano Hobby só permite cron diário.

**Fase F**
- **F13:** `/produtos` com CRUD e foto (mesma técnica da capa) e a lista de reservas com status. Na página pública, uma seção "Produtos" com "Reservar para retirar" (nome e telefone, que recusa banido) e "Pedir pelo WhatsApp".

**Final:** atualize `tests/integration/helpers.ts`, o seed e o `../STATUS-DO-PROJETO.md`. Rode tsc, lint, os testes de integração e `next build`. Depois faça o merge de `dev/roadmap-outubro` na `main` e o `git push` para subir a produção. Por fim, configure na Vercel as envs novas: `PLATFORM_PIX_KEY`, `NEXT_PUBLIC_SUPPORT_WHATSAPP`, `AI_GATEWAY_API_KEY` (opcional) e `APP_URL` (quando houver domínio).

## Decisões em aberto (perguntar ao Lucas)
- Provedor de WhatsApp: Meta oficial ou Z-API e similares (adiado).
- Chave PIX real da plataforma e número de WhatsApp de suporte e comercial.
- Domínio próprio.
