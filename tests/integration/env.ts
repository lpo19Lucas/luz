// Roda antes de qualquer módulo do teste ser importado (Jest `setupFiles`).
// Força o Prisma Client (lido via DATABASE_URL, ver schema.prisma) a apontar
// pro banco de teste isolado (`postgres_test` no docker-compose), nunca pro
// banco de dev — testes de integração fazem TRUNCATE entre casos.
if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    "TEST_DATABASE_URL não definida. Rode via `docker compose exec app npm run test:integration` " +
      "(o compose já injeta essa variável apontando pro serviço postgres_test)."
  );
}

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

// Notificações em segundo plano (after()) não rodam nos testes: uma tarefa
// solta corre contra o TRUNCATE entre casos. Os testes de notificação chamam
// as funções diretamente. Ver dispatchInBackground em staffNotifications.ts.
process.env.DISABLE_BACKGROUND_NOTIFICATIONS = "1";
