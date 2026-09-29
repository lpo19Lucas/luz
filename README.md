# Barbearia — Plataforma de Agendamento (scaffold do MVP)

Scaffold gerado a partir de `spec-funcional-mvp-barbearia.md` e `arquitetura-modelo-de-dados.md`. Ainda não roda — é a estrutura + as peças de lógica mais críticas já implementadas de verdade, pra você continuar em cima em vez de começar do zero.

## Como rodar via Docker (recomendado — não precisa de Node/Postgres instalados na máquina)

Pré-requisito: [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado e rodando.

```bash
docker compose up --build
```

Isso sobe o Postgres, instala as dependências, gera o client do Prisma, roda a migration inicial (`prisma migrate dev --name init` — cria `prisma/migrations/` na primeira execução) e inicia o `next dev` em http://localhost:3000. As próximas vezes que rodar, a migration inicial já existirá e o comando só aplica o que houver de pendente.

Para parar: `docker compose down` (os dados do Postgres ficam persistidos no volume `postgres_data`; use `docker compose down -v` pra zerar o banco também).

**Se editar código e a mudança não aparecer:** no Docker Desktop com Windows, o bind mount (`.:/app`) às vezes não propaga eventos de arquivo pro `inotify` do Linux dentro do container — o Next.js fica servindo a versão antiga do arquivo silenciosamente, sem erro nenhum. O `docker-compose.yml` já liga `WATCHPACK_POLLING`/`CHOKIDAR_USEPOLLING` pra isso não acontecer, mas se ainda assim uma mudança não refletir, `docker compose restart app` resolve.

**Rodando `npm run build` manualmente dentro do container:** o `docker-compose.yml` fixa `NODE_ENV=development` (correto pro `next dev`), mas isso faz `next build` falhar com `<Html> should not be imported outside of pages/_document` ao gerar a página 404 — é um bug conhecido do Next.js quando `NODE_ENV` não é `production` durante o build. Rode assim: `docker compose exec -e NODE_ENV=production app npm run build`.

## Como rodar localmente sem Docker (precisa de Node.js e Postgres instalados)

```bash
npm install
cp .env.example .env   # ajuste DATABASE_URL pro seu Postgres
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

Não rodei nada disso aqui — o sandbox onde montei esse scaffold não tem acesso ao registry do npm. Validar `npm install` e `prisma migrate dev` é o primeiro passo ao abrir isso na sua máquina.

## Testes

Stack: **Jest** (unitário) + **Testing Library** (componentes) + **Playwright** (E2E).

```bash
# Unitário/componente — rápido, não precisa de banco
docker compose exec app npm test

# Integração — bate no Postgres real do serviço postgres_test (já sobe junto no docker compose up)
docker compose exec app npm run test:integration

# E2E — precisa do app rodando em http://localhost:3000 e dos browsers do Playwright instalados
docker compose exec app npx playwright install --with-deps chromium
docker compose exec app npm run test:e2e
```

- **Unitário** (`*.test.tsx`, ambiente jsdom): hoje não há nenhum ainda porque todas as páginas são placeholder (`return null`) — não há o que testar de verdade até a UI existir. O setup (`jest.setup.ts`, Testing Library) já está pronto para quando as telas forem implementadas.
- **Integração** (`*.integration.test.ts`, ambiente node, roda contra Postgres real): cobre as 4 rotas de API que já têm lógica — criação de agendamento (conflito de horário, upsert de cliente, geração dos jobs de WhatsApp), cancelamento, confirmação de presença e o processador da fila de WhatsApp. Ver `tests/integration/helpers.ts` para os fixtures (`resetDb`, `createTestSalon`).
- **E2E** (`e2e/*.spec.ts`, Playwright): os testes existem como esqueleto (`test.skip`) descrevendo os fluxos-alvo (agendamento, cancelamento, confirmação de presença, agenda do dono) — ficam pulados até a UI real existir, pra não mascarar um resultado que não significa nada.

## O que já tem lógica real (não é só placeholder)

- **`prisma/schema.prisma`** — os 12 modelos completos.
- **`src/lib/prisma.ts`** — client singleton + o helper `scopedToSalon` (arquitetura seção 2).
- **`src/app/api/salons/[salonSlug]/appointments/route.ts`** — criação de agendamento com prevenção de conflito de horário via transação `SERIALIZABLE` (arquitetura seção 4, Opção A), upsert de cliente por telefone, e disparo dos 3 tipos de job de WhatsApp.
- **`src/app/api/appointments/[accessToken]/cancel/route.ts`** e **`.../confirm-presence/route.ts`** — as duas ações que o cliente faz sem login, autenticadas só pelo token da URL.
- **`src/app/api/cron/whatsapp-jobs/route.ts`** — o consumidor da fila própria (tabela `whatsapp_message_jobs`). O envio real pro provedor de WhatsApp ainda é um `console.log` — falta a integração com a Meta Cloud API.

## O que é só esqueleto (placeholder, sem lógica)

Todas as páginas em `src/app/(public)` e `src/app/(dashboard)` — cada arquivo tem um comentário apontando pra qual seção da spec ela implementa e qual exemplo do `mui-exemplos.html` usar de referência visual. Nenhuma tela foi construída ainda.

## O que falta antes de rodar em produção (não é escopo desse scaffold)

- ~~Autenticação do dono~~ — implementada (`src/lib/auth.ts`, cookie JWT).
- Integração real com WhatsApp (Meta Cloud API) — hoje é só log. Maior pendência real do MVP (ver `STATUS-DO-PROJETO.md`).
- ~~A segunda metade da confirmação de presença~~ — implementada: `handleNoShows` em `src/app/api/cron/whatsapp-jobs/route.ts` checa `PresenceConfirmationConfig.actionOnNoConfirm` e age (cancela ou sinaliza no dashboard).
- ~~Proteção do endpoint de cron~~ — implementada via `CRON_SECRET` (ver `.env.example`).
- ~~Tela de conciliação manual da assinatura~~ — implementada em `/admin` (protegida por `ADMIN_PASSWORD`, ver `.env.example`).

Ver `STATUS-DO-PROJETO.md` (na raiz do projeto, fora de `app/`) para o status completo e atualizado — este README documenta principalmente a estrutura do scaffold original.

## Estrutura de rotas

```
src/app/
├── (public)/[salonSlug]/                      → site público do salão (sem login)
│   ├── page.tsx                                → agendamento self-service
│   └── agendamento/[accessToken]/page.tsx      → gerenciar 1 agendamento (cancelar/reagendar/confirmar)
├── (dashboard)/                                → área do dono (autenticada — auth ainda não implementada)
│   ├── agenda/page.tsx
│   ├── profissionais/page.tsx
│   ├── servicos/page.tsx
│   ├── assinatura/page.tsx
│   └── metricas/page.tsx
└── api/
    ├── salons/[salonSlug]/appointments/route.ts        → POST criar agendamento
    ├── appointments/[accessToken]/cancel/route.ts       → POST cancelar
    ├── appointments/[accessToken]/confirm-presence/route.ts → POST confirmar presença
    └── cron/whatsapp-jobs/route.ts                      → GET processa fila de WhatsApp
```
